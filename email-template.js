'use strict';
/* ============================================================
   E-MAIL DE CONFIRMAÇÃO: é AQUI que você muda textos e visual.
   ============================================================ */

/* ---- 1. TEXTOS (edite à vontade) ---- */
const CONTEUDO = {
  assunto: 'Você está na lista da demo de Incógnita',
  titulo: 'Você está na lista!',
  paragrafos: [
    'Recebemos o seu e-mail e você garantiu a vaga no acesso antecipado à demo de Incógnita.',
    'Assim que a demo estiver pronta, você será um dos primeiros a receber o link por aqui.'
  ],
  /* Botão (só aparece se SITE_URL estiver no .env). Deixe '' para não ter botão. */
  textoBotao: 'Conhecer o jogo',
  rodape: 'Você recebeu este e-mail porque se inscreveu no acesso antecipado de Incógnita. Se não foi você, é só ignorar esta mensagem.',
  assinatura: 'Equipe Incógnita'
};

/* ---- 2. CORES (as mesmas do site) ---- */
const COR = {
  fundo: '#0d0e1a',
  cartao: '#171830',
  borda: '#34365a',
  texto: '#ebeae4',
  textoSuave: '#b4b7c3',
  destaque: '#e8a94a',   /* âmbar do botão */
  verde: '#94c9b4'
};

/* ---- 3. IMAGENS ----
   Ficam dentro do próprio e-mail (anexo "cid"), por isso funcionam sem site publicado.
   Para trocar, mude o arquivo dentro de public/assets/. Para tirar o banner, use banner: null. */
const IMAGENS = {
  logo:   { arquivo: 'assets/logo.png',      cid: 'logo@incognita' },
  banner: { arquivo: 'assets/og-image.jpg',  cid: 'banner@incognita' }
};

const path = require('path');

/* Gera os anexos de imagem para o nodemailer */
function anexos() {
  return Object.values(IMAGENS)
    .filter(Boolean)
    .map((img) => ({
      filename: path.basename(img.arquivo),
      path: path.join(__dirname, 'public', img.arquivo),
      cid: img.cid
    }));
}

/* srcFn permite o preview mostrar as imagens direto da pasta */
function html(opcoes) {
  const o = opcoes || {};
  const src = o.src || ((img) => 'cid:' + img.cid);
  const siteUrl = (o.siteUrl || '').replace(/\/$/, '');

  const paragrafos = CONTEUDO.paragrafos
    .map((p) => '<p style="margin:0 0 16px;font-size:17px;line-height:1.6;color:' + COR.texto + ';">' + p + '</p>')
    .join('');

  const botao = siteUrl && CONTEUDO.textoBotao
    ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr>' +
      '<td bgcolor="' + COR.destaque + '" style="border-radius:4px;">' +
      '<a href="' + siteUrl + '" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#0d0e1a;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">' +
      CONTEUDO.textoBotao + '</a></td></tr></table>'
    : '';

  const banner = IMAGENS.banner
    ? '<tr><td style="padding:0;"><img src="' + src(IMAGENS.banner) + '" width="560" alt="Incógnita" style="display:block;width:100%;max-width:560px;height:auto;border:0;"></td></tr>'
    : '';

  return '<!DOCTYPE html>' +
'<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>' + CONTEUDO.assunto + '</title></head>' +
'<body style="margin:0;padding:0;background:' + COR.fundo + ';" bgcolor="' + COR.fundo + '">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + COR.fundo + '" style="background:' + COR.fundo + ';">' +
'<tr><td align="center" style="padding:32px 16px;">' +
  '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:Arial,Helvetica,sans-serif;">' +
    /* logo */
    '<tr><td align="center" style="padding:0 0 24px;">' +
      '<img src="' + src(IMAGENS.logo) + '" width="260" alt="INCÓGNITA" style="display:block;width:260px;max-width:100%;height:auto;border:0;">' +
    '</td></tr>' +
    /* cartão */
    '<tr><td bgcolor="' + COR.cartao + '" style="background:' + COR.cartao + ';border:1px solid ' + COR.borda + ';border-radius:6px;overflow:hidden;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        banner +
        '<tr><td style="padding:32px 32px 24px;">' +
          '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:' + COR.verde + ';margin:0 0 10px;font-family:\'Courier New\',monospace;">Acesso antecipado</div>' +
          '<h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;color:' + COR.texto + ';font-family:\'Courier New\',monospace;">' + CONTEUDO.titulo + '</h1>' +
          paragrafos +
          botao +
          '<p style="margin:24px 0 0;font-size:16px;color:' + COR.textoSuave + ';">' + CONTEUDO.assinatura + '</p>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +
    /* rodapé */
    '<tr><td align="center" style="padding:20px 8px 0;font-size:12px;line-height:1.5;color:#7d8196;">' + CONTEUDO.rodape + '</td></tr>' +
  '</table>' +
'</td></tr></table></body></html>';
}

/* Versão só texto (para quem não mostra HTML) */
function texto(opcoes) {
  const siteUrl = ((opcoes && opcoes.siteUrl) || '').replace(/\/$/, '');
  return CONTEUDO.titulo + '\n\n' +
    CONTEUDO.paragrafos.join('\n\n') + '\n\n' +
    (siteUrl ? siteUrl + '\n\n' : '') +
    CONTEUDO.assinatura + '\n\n' + CONTEUDO.rodape;
}

module.exports = { CONTEUDO, html, texto, anexos };
