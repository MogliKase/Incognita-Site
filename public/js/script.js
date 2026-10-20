'use strict';

/* ============================================================
   INCÓGNITA: comportamento da one-page
   1. Imagens que ainda não existem mostram o texto-guia.
   2. Formulário envia o e-mail para a API do backend.
   ============================================================ */

/* Endereço da API.
   - '' (vazio): o site e a API estão no mesmo servidor (recomendado, ver README).
   - 'http://localhost:3000': site aberto pelo Live Server e API em outra porta
     (neste caso o backend precisa liberar CORS). */
var API_BASE = '';

var ENDPOINT = API_BASE + '/api/v1/marketing/subscribe';

/* Mesmas mensagens do backend, usadas se a API não responder. */
var MSG = {
  created: 'Inscrição confirmada! Em breve você receberá sua demo.',
  duplicate: 'Este e-mail já está na lista. Fique de olho na caixa de entrada!',
  invalid: 'Informe um e-mail válido.',
  error: 'Algo deu errado. Tente novamente em instantes.'
};

/* ---------- 1. imagens ausentes ---------- */
document.querySelectorAll('[data-slot-img]').forEach(function (img) {
  var slot = img.closest('.slot');
  function falhou() { if (slot) slot.classList.add('has-error'); }
  img.addEventListener('error', falhou);
  if (img.complete && img.naturalWidth === 0) falhou();
});

/* ---------- 2. demo trancada + formulário ----------
   A demo só é liberada para quem abre o cofre do minigame. O servidor confere de verdade:
   o "passe" (token) é emitido por ele e a inscrição é recusada sem um passe válido. */
var Gate = window.Gate = (function () {
  var CHAVE = 'incognita.passe.v1';
  var memoria = null;
  var lock = document.getElementById('demo-lock');
  var formEl = document.getElementById('form-demo');
  var texto = document.getElementById('demo-texto');
  var TXT_TRANCADA = 'A demo de Incógnita é para quem investiga. Abra o cofre do laboratório para liberar o acesso.';
  var TXT_LIBERADA = 'Cofre aberto! Deixe seu e-mail e receba o acesso antecipado à demo de Incógnita.';

  function lerSalvo() {
    try {
      var o = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (o && o.token && o.expira > Date.now()) return o.token;
    } catch (e) {}
    return null;
  }
  function token() { return memoria || lerSalvo(); }

  function mostrarForm(animar) {
    if (texto) texto.textContent = TXT_LIBERADA;
    function trocar() {
      if (lock) lock.hidden = true;
      if (formEl) { formEl.hidden = false; if (animar) formEl.classList.add('revelado'); }
    }
    if (animar && lock && !reduzir0) {
      lock.classList.add('abrindo');
      setTimeout(trocar, 1100);
    } else trocar();
  }
  function mostrarLock() {
    if (texto) texto.textContent = TXT_TRANCADA;
    if (lock) { lock.hidden = false; lock.classList.remove('abrindo'); }
    if (formEl) { formEl.hidden = true; formEl.classList.remove('revelado'); }
  }
  var reduzir0 = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var api = {
    liberado: function () { return !!token(); },
    token: token,
    liberar: function (tok, expira, animar) {
      memoria = tok;
      try { localStorage.setItem(CHAVE, JSON.stringify({ token: tok, expira: expira || (Date.now() + 864e5) })); } catch (e) {}
      if (animar === 'ao-ver' && 'IntersectionObserver' in window && lock && !lock.hidden) {
        /* o cadeado só abre (com animação) quando a pessoa chega na seção da demo */
        var io = new IntersectionObserver(function (es) {
          if (es[0].isIntersecting) { io.disconnect(); mostrarForm(true); }
        }, { threshold: 0.5 });
        io.observe(lock);
      } else mostrarForm(!!animar);
      document.dispatchEvent(new CustomEvent('incognita:liberado'));
    },
    travar: function () {
      memoria = null;
      try { localStorage.removeItem(CHAVE); } catch (e) {}
      mostrarLock();
    },
    /* o passe é de uso único: depois de inscrever, ele some */
    consumir: function () { memoria = null; try { localStorage.removeItem(CHAVE); } catch (e) {} }
  };
  if (api.liberado()) mostrarForm(false);
  return api;
})();

var form = document.getElementById('form-demo');
var input = document.getElementById('email');
var button = document.getElementById('form-btn');
var msg = document.getElementById('form-msg');

function mostrar(texto, tipo) {
  msg.textContent = texto;
  msg.className = 'form-msg' + (tipo ? ' ' + tipo : '');
}

if (form) form.addEventListener('submit', function (ev) {
  ev.preventDefault();

  var passe = Gate.token();
  if (!passe) {
    Gate.travar();
    return;
  }

  var email = input.value.trim();
  if (!input.checkValidity() || email.length < 6) {
    mostrar(MSG.invalid, 'erro');
    input.focus();
    return;
  }

  var origem = form.elements.origem ? form.elements.origem.value : 'landing_page';
  button.disabled = true;
  mostrar('Enviando…', '');

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, origem: origem, token: passe })
  })
    .then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 201) {
          mostrar(data.message || MSG.created, 'ok');
          form.reset();
          Gate.consumir();
          button.disabled = true; input.disabled = true;
          return;
        } else if (res.status === 200) {
          mostrar(data.message || MSG.duplicate, 'ok');
        } else if (res.status === 403) {
          mostrar('', '');
          Gate.travar();
          document.dispatchEvent(new CustomEvent('incognita:travado'));
        } else if (res.status === 400) {
          mostrar(data.message || MSG.invalid, 'erro');
        } else {
          /* 429 (muitas tentativas), 500 etc. */
          mostrar(data.message || MSG.error, 'erro');
        }
        button.disabled = false;
      });
    })
    .catch(function () { mostrar(MSG.error, 'erro'); button.disabled = false; });
});


/* ---------- 3. animações e menu ---------- */
document.documentElement.classList.add('js');
var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* menu do celular */
var toggle = document.querySelector('.nav-toggle');
var nav = document.getElementById('nav');
if (toggle && nav) {
  toggle.addEventListener('click', function () {
    var aberto = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  });
}

/* cards aparecem ao entrar na tela */
var alvos = document.querySelectorAll('.head, .plaque, .feature, .char, .maker, .ref, .shots figure, .cta-inner');
alvos.forEach(function (el, i) { el.classList.add('reveal'); el.style.setProperty('--rd', ((i % 3) * 0.12) + 's'); });
if ('IntersectionObserver' in window && !reduzir) {
  var io = new IntersectionObserver(function (itens) {
    itens.forEach(function (it) { if (it.isIntersecting) { it.target.classList.add('in'); io.unobserve(it.target); } });
  }, { threshold: 0.15 });
  alvos.forEach(function (el) { io.observe(el); });
} else {
  alvos.forEach(function (el) { el.classList.add('in'); });
}

/* o céu é um só e desliza devagar enquanto a página rola, ligando todas as seções */
var cena = document.querySelector('.scene');
if (cena && !reduzir) {
  var ticking = false;
  function atualizarCena() {
    var vh = window.innerHeight;
    var rolavel = Math.max(document.documentElement.scrollHeight - vh, 1);
    var p = Math.min(Math.max(window.scrollY / rolavel, 0), 1);
    var folga = cena.offsetHeight - vh;               /* quanto do céu sobra além da janela */
    cena.style.setProperty('--sy', (-p * folga) + 'px');
    cena.style.setProperty('--dim', Math.min(window.scrollY / (vh * 0.9), 1) * 0.42);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(atualizarCena);
  }, { passive: true });
  window.addEventListener('resize', atualizarCena);
  atualizarCena();
}


/* ---------- 4. slogan digitado ---------- */
var slogan = document.querySelector('.slogan');
if (slogan && !reduzir) {
  var fraseCompleta = slogan.textContent.trim();
  slogan.setAttribute('aria-label', fraseCompleta);
  slogan.textContent = '';
  slogan.classList.add('typing');
  var pos = 0;
  setTimeout(function digitar() {
    slogan.textContent = fraseCompleta.slice(0, ++pos);
    if (pos < fraseCompleta.length) {
      setTimeout(digitar, fraseCompleta.charAt(pos - 1) === ',' ? 260 : 38);
    } else {
      slogan.classList.remove('typing');
      slogan.classList.add('typed');
    }
  }, 1700);
}

/* ---------- 5. luz que segue o mouse ---------- */
var luz = document.querySelector('.light');
if (luz && !reduzir && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  var alvoX = 0, alvoY = 0, luzX = 0, luzY = 0, rodando = false;
  function mover() {
    luzX += (alvoX - luzX) * 0.12;
    luzY += (alvoY - luzY) * 0.12;
    luz.style.transform = 'translate(' + luzX + 'px,' + luzY + 'px)';
    if (Math.abs(alvoX - luzX) > 0.5 || Math.abs(alvoY - luzY) > 0.5) requestAnimationFrame(mover);
    else rodando = false;
  }
  window.addEventListener('mousemove', function (e) {
    alvoX = e.clientX; alvoY = e.clientY;
    if (!luz.classList.contains('on')) { luzX = alvoX; luzY = alvoY; luz.classList.add('on'); }
    if (!rodando) { rodando = true; requestAnimationFrame(mover); }
  }, { passive: true });
}

/* ---------- 6. transição entre páginas ---------- */
document.addEventListener('click', function (e) {
  var a = e.target.closest ? e.target.closest('a[href]') : null;
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target || a.origin !== location.origin || !/\.html$/.test(a.pathname)) return;
  if (a.pathname === location.pathname || reduzir) return;
  e.preventDefault();
  document.documentElement.classList.add('leaving');
  setTimeout(function () { location.href = a.href; }, 260);
});
window.addEventListener('pageshow', function (e) {
  if (e.persisted) document.documentElement.classList.remove('leaving');
});

/* ---------- 7. galeria com zoom ---------- */
var lightbox = null, ultimoFoco = null;
function fecharZoom() {
  if (!lightbox) return;
  lightbox.remove(); lightbox = null;
  document.removeEventListener('keydown', teclaZoom);
  if (ultimoFoco) ultimoFoco.focus();
}
function teclaZoom(e) { if (e.key === 'Escape') fecharZoom(); }
function abrirZoom(img) {
  ultimoFoco = document.activeElement;
  lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', img.alt || 'Imagem ampliada');
  var grande = document.createElement('img');
  grande.src = img.currentSrc || img.src; grande.alt = img.alt;
  var fechar = document.createElement('button');
  fechar.type = 'button'; fechar.textContent = 'Fechar';
  lightbox.appendChild(grande); lightbox.appendChild(fechar);
  if (img.alt) { var legenda = document.createElement('p'); legenda.textContent = img.alt; lightbox.appendChild(legenda); }
  lightbox.addEventListener('click', fecharZoom);
  document.body.appendChild(lightbox);
  document.addEventListener('keydown', teclaZoom);
  fechar.focus();
}
document.querySelectorAll('.shots img, .frame-story img, .frame-ref img, .frame-char img').forEach(function (img) {
  img.classList.add('zoomable');
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  img.addEventListener('click', function () { abrirZoom(img); });
  img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirZoom(img); } });
});


/* ---------- 8. menu da one-page: destaca a seção atual e fecha no celular ---------- */
var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
links.forEach(function (a) {
  a.addEventListener('click', function () {
    if (nav) nav.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
});
function marcar(id) {
  links.forEach(function (a) {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}
if ('IntersectionObserver' in window) {
  var secoes = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  var spy = new IntersectionObserver(function (itens) {
    itens.forEach(function (it) { if (it.isIntersecting) marcar(it.target.id); });
  }, { rootMargin: '-35% 0px -60% 0px' });
  secoes.forEach(function (s) { spy.observe(s); });
  marcar('inicio');
}
