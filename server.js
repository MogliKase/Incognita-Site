'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const tpl = require('./email-template');
const GAME = require('./game-config');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'subscribers.json');

/* ---------- "banco" em arquivo JSON ---------- */
function lerLista() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return []; }
}
function salvarLista(lista) {
  fs.writeFileSync(DB_FILE, JSON.stringify(lista, null, 2));
}

/* ---------- e-mail (SMTP) ---------- */
const smtpOk = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = smtpOk
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

if (transporter) {
  transporter.verify()
    .then(() => console.log('SMTP ok: e-mails de confirmação ativados.'))
    .catch((e) => console.error('SMTP com problema:', e.message));
} else {
  console.log('SMTP não configurado: os e-mails serão salvos, mas nada será enviado.');
}

async function enviarConfirmacao(email) {
  if (!transporter) return;
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const opcoes = { siteUrl: process.env.SITE_URL || '' };
  await transporter.sendMail({
    from,
    to: email,
    subject: tpl.CONTEUDO.assunto,
    text: tpl.texto(opcoes),
    html: tpl.html(opcoes),
    attachments: tpl.anexos()
  });
  if (process.env.NOTIFY_TO) {
    await transporter.sendMail({
      from,
      to: process.env.NOTIFY_TO,
      subject: 'Nova inscrição na demo',
      text: 'Novo e-mail inscrito: ' + email
    });
  }
}

/* ---------- servidor ---------- */
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* limite simples por IP (cada rota tem o seu contador) */
function criarLimite(max, janelaMs) {
  const tentativas = new Map();
  return function limitar(req, res, next) {
    const agora = Date.now();
    const lista = (tentativas.get(req.ip) || []).filter((t) => agora - t < janelaMs);
    lista.push(agora);
    tentativas.set(req.ip, lista);
    if (lista.length > max) {
      return res.status(429).json({ message: 'Muitas tentativas. Aguarde um minuto.' });
    }
    next();
  };
}
const limitarInscricao = criarLimite(10, 60000);
const limitarEtapa = criarLimite(60, 60000);
const limitarCofre = criarLimite(10, 60000);

/* ---------- token de "completei o minigame" ----------
   Assinado com HMAC. Vale por 24 h e só pode ser usado em UMA inscrição.
   Defina GAME_SECRET no .env para os tokens continuarem válidos depois de reiniciar o servidor. */
const SEGREDO = process.env.GAME_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_VALIDADE_MS = 24 * 60 * 60 * 1000;
const tokensUsados = new Map(); /* nonce -> expiração */

function assinar(texto) {
  return crypto.createHmac('sha256', SEGREDO).update(texto).digest('base64url');
}
function emitirToken() {
  const dados = { n: crypto.randomBytes(12).toString('hex'), e: Date.now() + TOKEN_VALIDADE_MS };
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return { token: corpo + '.' + assinar(corpo), expira: dados.e };
}
function lerToken(token) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const esperado = Buffer.from(assinar(partes[0]));
  const recebido = Buffer.from(partes[1]);
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  let dados;
  try { dados = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!dados || typeof dados.n !== 'string' || typeof dados.e !== 'number') return null;
  if (dados.e < Date.now() || tokensUsados.has(dados.n)) return null;
  return dados;
}
setInterval(() => {
  const agora = Date.now();
  tokensUsados.forEach((exp, n) => { if (exp < agora) tokensUsados.delete(n); });
}, 60 * 60 * 1000).unref();

/* ---------- API do minigame ---------- */
/* o navegador manda a resposta de uma etapa; se estiver certa, o servidor devolve o dígito da folha */
app.post('/api/v1/game/etapa', limitarEtapa, (req, res) => {
  const id = String((req.body && req.body.id) || '');
  const etapa = Object.prototype.hasOwnProperty.call(GAME.etapas, id) ? GAME.etapas[id] : null;
  if (!etapa) return res.status(400).json({ ok: false, message: 'Etapa desconhecida.' });
  let certa = false;
  try { certa = !!etapa.valida(req.body.resposta); } catch (e) { certa = false; }
  if (!certa) return res.json({ ok: false });
  res.json({ ok: true, folha: etapa.folha, digito: etapa.digito });
});

/* o código do cofre: se estiver certo, devolve o token que libera a inscrição */
app.post('/api/v1/game/cofre', limitarCofre, (req, res) => {
  const codigo = String((req.body && req.body.codigo) || '').replace(/\D/g, '');
  if (codigo !== GAME.codigo) return res.json({ ok: false });
  const t = emitirToken();
  res.json({ ok: true, token: t.token, expira: t.expira });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.post('/api/v1/marketing/subscribe', limitarInscricao, (req, res) => {
  /* a demo só é liberada para quem abriu o cofre do minigame */
  const tokenDados = lerToken(req.body && req.body.token);
  if (!tokenDados) {
    return res.status(403).json({
      codigo: 'JOGO_PENDENTE',
      message: 'Complete o mini-jogo e abra o cofre para liberar a demo.'
    });
  }

  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const origem = String((req.body && req.body.origem) || 'landing_page').slice(0, 50);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Informe um e-mail válido.' });
  }

  const lista = lerLista();
  if (lista.some((s) => s.email === email)) {
    return res.status(200).json({ message: 'Este e-mail já está na lista. Fique de olho na caixa de entrada!' });
  }

  lista.push({ email, origem, criadoEm: new Date().toISOString(), jogo: true });
  try { salvarLista(lista); }
  catch (e) {
    console.error('Erro ao salvar:', e);
    return res.status(500).json({ message: 'Algo deu errado. Tente novamente em instantes.' });
  }

  tokensUsados.set(tokenDados.n, tokenDados.e); /* este token não serve para outra inscrição */

  /* responde já; o envio do e-mail roda em segundo plano */
  res.status(201).json({ message: 'Inscrição confirmada! Em breve você receberá sua demo.' });
  enviarConfirmacao(email).catch((e) => console.error('Falha ao enviar e-mail para', email, '-', e.message));
});

app.listen(PORT, () => console.log('Site no ar em http://localhost:' + PORT));
