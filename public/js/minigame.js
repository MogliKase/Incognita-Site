'use strict';
/* ============================================================
   MINIGAME: investigue o laboratório (Capítulo 0)
   - Todos os textos estão no bloco TEXTOS logo abaixo.
   - As RESPOSTAS dos enigmas ficam no servidor (game-config.js). Aqui só existem as pistas.
   - Jogo 100% visual: sem som, sem tempo limite, sem punição.
   ============================================================ */
(function () {
  var raiz = document.getElementById('game');
  if (!raiz) return;

  var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SALVO = 'incognita.jogo.v1';
  var API = '/api/v1/game/';

  /* ---------------- TEXTOS ---------------- */
  var TEXTOS = {
    intro: [
      'Silêncio. Nem o tique-taque de um relógio. O laboratório parece estar esperando por mim.',
      'O Cientista sumiu e deixou um cofre trancado. Se eu achar quatro folhas, talvez descubra o código.',
      'Vou olhar tudo com calma. Clique nos objetos da sala. Se eu travar, o botão “Dica” me ajuda.'
    ],
    folhas: {
      quadro: { n: 1, k: 'Folha 1', titulo: 'Anotação no quadro', texto: 'Escrito a giz, quase apagado: “A experiência começou na ala número sete.”' },
      frascos: { n: 2, k: 'Folha 2', titulo: 'Dentro do compartimento', texto: 'Uma folha dobrada em quatro: “Dois turnos por noite. Nunca um só.”' },
      gaveta: { n: 3, k: 'Folha 3', titulo: 'Na gaveta trancada', texto: 'Uma folha amassada, com a letra apressada do Cientista:', pergunta: 'Na noite do apagão, quantas janelas da vila ficaram ACESAS? Olhe pela janela do laboratório e conte.', depois: '“Nove janelas acesas. Sempre nove.”' },
      relogio: { n: 4, k: 'Folha 4', titulo: 'Atrás do relógio', texto: 'Colada no fundo do compartimento: “O ponteiro parou às quatro.”' }
    },
    diario: [
      { t: 'Dia 12', x: 'O Cientista exigiu silêncio absoluto no laboratório. Ninguém fala. Aprendemos a conversar só com as mãos, e ninguém nunca perdeu uma ideia por isso.' },
      { t: 'Dia 19', x: 'Os frascos da bancada só reagem se forem acionados em ordem de temperatura: sempre do mais frio ao mais quente. Se errar, nada acontece. (Nada explode também. Eu acho.)' },
      { t: 'Dia 23', x: 'O relógio da parede esconde um compartimento. A trava só cede na hora exata em que as luzes caíram: 4 horas e 10 minutos. O Cientista nunca confiou em chaves para tudo.' },
      { t: 'Dia 24', x: 'Há uma gaveta que ele nunca deixa aberta. A chave? Pendurou onde ninguém olha: no alto, perto da luz.' },
      { t: 'Dia 30', x: 'Os quatro papéis, EM ORDEM, formam o código do cofre. Folha 1, folha 2, folha 3, folha 4. Não inverta.' }
    ],
    extras: {
      cartaz: 'Um cartaz: “SILÊNCIO · EXPERIMENTO EM CURSO”. Aqui, silêncio nunca foi falta de conversa.',
      gato: 'Um gato dormindo no meio do laboratório. Ele abre um olho, me avalia e decide que não sou ameaça.',
      planta: 'Uma planta quase morta. Mas olha: tem uma folhinha verde nascendo. Alguém ainda cuida dela.'
    },
    final: [
      'O cofre abriu! Dentro só tem um bilhete: “Quem chegou até aqui merece jogar primeiro.”',
      'Foi o Cientista que deixou isso pra mim? Ou pra quem está jogando agora? Acho que o acesso à demo é seu.'
    ]
  };

  /* ---------------- estado ---------------- */
  var S = estadoNovo();
  function estadoNovo() {
    return { iniciou: false, lampada: false, chave: false, gavetaAberta: false, livro: false, folhas: {}, extras: {}, dicas: 0, ms: 0 };
  }
  var passo = { n: {}, t0: 0 };   /* contador de dicas por etapa */
  var ultimaAcao = Date.now();

  function carregar() {
    try {
      var o = JSON.parse(localStorage.getItem(SALVO) || 'null');
      if (!o || typeof o !== 'object') return;
      var base = estadoNovo();
      Object.keys(base).forEach(function (k) { if (o[k] !== undefined && typeof o[k] === typeof base[k]) base[k] = o[k]; });
      ['quadro', 'frascos', 'gaveta', 'relogio'].forEach(function (id) {
        var d = base.folhas[id];
        if (d !== undefined && !/^\d$/.test(String(d))) delete base.folhas[id];
      });
      S = base;
    } catch (e) {}
  }
  function tempoAtual() { return S.ms + (passo.t0 ? Date.now() - passo.t0 : 0); }
  function salvar() {
    try { S.ms = tempoAtual(); passo.t0 = Date.now(); localStorage.setItem(SALVO, JSON.stringify(S)); } catch (e) {}
  }
  function apagarSalvo() { try { localStorage.removeItem(SALVO); } catch (e) {} }

  function nFolhas() { return Object.keys(S.folhas).length; }
  function concluido() { return !!(window.Gate && window.Gate.liberado()); }

  /* ---------------- utilidades ---------------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function R(x, y, w, h, f, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function pausa(ms) { return new Promise(function (r) { setTimeout(r, reduzir ? Math.min(ms, 60) : ms); }); }
  function api(rota, corpo) {
    return fetch(API + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) {
        if (r.status === 429) return r.json().catch(function () { return {}; }).then(function (d) { return { erroRede: d.message || 'Muitas tentativas. Aguarde um minuto.' }; });
        return r.json();
      })
      .catch(function () { return { erroRede: 'Sem conexão com o servidor. Abra o site pelo endereço do servidor (npm start) e tente de novo.' }; });
  }
  function dois(n) { return n < 10 ? '0' + n : '' + n; }

  /* ============================================================
     ARTE: a cidade (usada na janela da sala e na janela ampliada)
     Quantas janelas acesas? A contagem precisa bater com game-config.js (9).
     ============================================================ */
  var PREDIOS = [
    { x: 2, y: 46, w: 26, cols: 3, rows: 4, cor: '#0f1024', acesas: [[0, 1], [2, 2]], reflexo: [[1, 2]] },
    { x: 30, y: 28, w: 30, cols: 3, rows: 6, cor: '#0b0c1c', acesas: [[1, 0], [0, 2], [2, 4]], reflexo: [[0, 4], [2, 1]] },
    { x: 62, y: 60, w: 22, cols: 2, rows: 3, cor: '#12132a', acesas: [[1, 1]], reflexo: [[0, 0]] },
    { x: 86, y: 40, w: 32, cols: 3, rows: 5, cor: '#0d0e1f', acesas: [[0, 0], [2, 2], [1, 4]], reflexo: [[1, 1]] }
  ];
  function cidadeSVG(interativo) {
    var o = '';
    /* céu em faixas */
    var ceu = ['#14153a', '#181a44', '#1d2050', '#232660', '#2b2f70', '#34397c'];
    for (var i = 0; i < ceu.length; i++) o += R(0, i * 18, 120, 18, ceu[i]);
    /* estrelas */
    [[8, 6], [22, 14], [40, 8], [56, 20], [74, 6], [112, 30], [14, 30], [66, 34]].forEach(function (s, i) {
      o += R(s[0], s[1], 1.4, 1.4, '#ebeae4', ' class="estrela" style="animation-delay:' + (i * .37) + 's"');
    });
    /* lua */
    o += '<circle cx="98" cy="18" r="9" fill="#f2d27a" opacity=".16"/><circle cx="98" cy="18" r="6" fill="#f2d27a"/><circle cx="96" cy="16" r="1.4" fill="#d9b85a"/><circle cx="100" cy="20" r="1" fill="#d9b85a"/>';
    /* prédios */
    var total = 0, idx = 0;
    PREDIOS.forEach(function (p) {
      var h = 108 - p.y;
      o += R(p.x, p.y, p.w, h, p.cor);
      o += R(p.x, p.y, p.w, 2, '#1d2050');
      for (var r = 0; r < p.rows; r++) {
        for (var c = 0; c < p.cols; c++) {
          var wx = p.x + 3 + c * 8, wy = p.y + 8 + r * 12;
          var acesa = p.acesas.some(function (a) { return a[0] === c && a[1] === r; });
          var refl = p.reflexo.some(function (a) { return a[0] === c && a[1] === r; });
          var cor = acesa ? '#e8a94a' : refl ? '#3c4390' : '#1a1c3a';
          if (acesa) total++;
          var g = '';
          g += '<rect class="p" x="' + wx + '" y="' + wy + '" width="5" height="6" fill="' + cor + '"/>';
          if (acesa) g += R(wx + 1, wy + 1, 3, 1, '#f2d27a') + R(wx + 2, wy, 1, 6, '#b97a2a', ' opacity=".6"');
          if (interativo) {
            g += '<path class="marca" d="M' + (wx + .8) + ' ' + (wy + 3.2) + ' l1.6 1.8 l2.6 -4.2" fill="none" stroke="#6fe39a" stroke-width="1.1"/>';
            o += '<g class="jan" tabindex="0" role="button" aria-pressed="false" aria-label="Janela ' + (++idx) + ', clique para marcar" data-i="' + idx + '">' +
                 '<rect x="' + (wx - 1.5) + '" y="' + (wy - 1.5) + '" width="8" height="9" fill="transparent"/>' + g + '</g>';
          } else {
            o += g;
          }
        }
      }
    });
    /* detalhes dos telhados */
    o += R(44, 18, 2, 10, '#0b0c1c') + R(43, 16, 4, 2, '#0b0c1c') + R(92, 34, 4, 6, '#0d0e1f') + R(6, 40, 8, 6, '#0f1024') + R(8, 38, 1, 2, '#0f1024');
    /* neblina */
    o += '<g class="neblina-a"><rect x="-60" y="88" width="240" height="8" fill="#8a90c8" opacity=".10"/><rect x="-20" y="82" width="90" height="4" fill="#8a90c8" opacity=".08"/></g>';
    o += '<g class="neblina-b"><rect x="-60" y="96" width="240" height="14" fill="#8a90c8" opacity=".16"/></g>';
    cidadeSVG.total = total;
    return o;
  }
  cidadeSVG(false);

  /* ============================================================
     ARTE: o laboratório (SVG 320 x 180)
     ============================================================ */
  function frascoPix(x, y, cor, claro) {
    return R(x + 4, y - 14, 4, 5, '#cfd8dc', ' opacity=".55"') + R(x + 3, y - 15, 6, 1.4, '#9a9ea0') +
      R(x + 3, y - 9, 6, 2, '#cfd8dc', ' opacity=".4"') + R(x + 1, y - 7, 10, 2, '#cfd8dc', ' opacity=".4"') + R(x, y - 5, 12, 5, '#cfd8dc', ' opacity=".4"') +
      R(x + 1, y - 5, 10, 4, cor) + R(x + 2, y - 7, 8, 2, cor) +
      R(x + 2, y - 4, 2, 3, claro, ' opacity=".7"') + R(x, y - 1, 12, 1, '#0d0e1a', ' opacity=".4"');
  }
  function ponteiro(cx, cy, len, graus, cor, larg) {
    var a = graus * Math.PI / 180;
    return '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.sin(a) * len).toFixed(2) + '" y2="' + (cy - Math.cos(a) * len).toFixed(2) + '" stroke="' + cor + '" stroke-width="' + larg + '"/>';
  }

  function cenaSVG() {
    var o = '<svg class="cena-svg" viewBox="0 0 320 180" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    o += '<defs><radialGradient id="gLuz"><stop offset="0" stop-color="#f2d27a" stop-opacity=".55"/><stop offset=".45" stop-color="#e8a94a" stop-opacity=".18"/><stop offset="1" stop-color="#e8a94a" stop-opacity="0"/></radialGradient>' +
         '<radialGradient id="gCofre"><stop offset="0" stop-color="#f2d27a" stop-opacity=".9"/><stop offset="1" stop-color="#f2d27a" stop-opacity="0"/></radialGradient></defs>';

    /* parede, teto, lambri, piso */
    o += R(0, 0, 320, 130, '#151630');
    for (var x = 0; x < 320; x += 40) o += R(x, 10, 1, 94, '#1b1d3c');
    for (var yy = 24; yy < 100; yy += 24) o += R(0, yy, 320, 1, '#171834');
    o += R(0, 0, 320, 6, '#0f1024') + R(0, 6, 320, 3, '#20223e') + R(0, 9, 320, 1, '#0b0c1c');
    o += R(300, 9, 4, 48, '#20223e') + R(298, 56, 8, 4, '#2a2c4a') + R(301, 52, 2, 4, '#e8a94a');
    o += '<g class="vapor"><rect x="303" y="48" width="3" height="3" fill="#cfd3e6"/></g><g class="vapor" style="animation-delay:1.7s"><rect x="299" y="50" width="4" height="3" fill="#cfd3e6"/></g>';
    o += R(0, 104, 320, 26, '#1a1c38') + R(0, 104, 320, 2, '#34365a') + R(0, 128, 320, 2, '#0b0c1c');
    for (x = 0; x < 320; x += 20) o += R(x, 106, 1, 22, '#15162f');
    o += R(0, 130, 320, 50, '#1e1f3c');
    [138, 148, 159, 171].forEach(function (y, i) {
      o += R(0, y, 320, 1, '#15162f');
      for (var xx = (i % 2) * 24 + 8; xx < 320; xx += 48) o += R(xx, y - 10 + (i === 0 ? 8 : 0), 1, 10, '#15162f');
    });
    /* tapete */
    o += R(100, 150, 120, 24, '#2d1f33') + R(102, 152, 116, 20, '#3a2840') + R(104, 154, 112, 1, '#6b5230') + R(104, 170, 112, 1, '#6b5230') + R(104, 154, 1, 17, '#6b5230') + R(215, 154, 1, 17, '#6b5230');
    for (x = 112; x < 212; x += 12) o += R(x, 160, 4, 4, '#6b5230', ' opacity=".6"');

    /* janela */
    o += R(114, 66, 68, 3, '#4a4e5e') + R(116, 10, 64, 58, '#34365a');
    o += '<svg x="118" y="12" width="60" height="54" viewBox="0 0 120 108" shape-rendering="crispEdges">' + cidadeSVG(false) + '</svg>';
    o += R(147, 12, 2, 54, '#34365a') + R(118, 38, 60, 2, '#34365a') + R(118, 12, 60, 1, '#fff', ' opacity=".08"');
    o += '<polygon points="118,12 140,12 118,34" fill="#fff" opacity=".04"/>';

    /* quadro negro */
    o += R(10, 8, 96, 62, '#5a4a2a') + R(12, 10, 92, 56, '#16282b') + R(10, 8, 96, 1, '#8a6a35');
    o += '<g class="q-limpo">' +
         '<text x="58" y="40" font-family="Pixelify Sans, monospace" font-size="17" fill="#ebeae4" text-anchor="middle" shape-rendering="auto">ALA 7</text>' +
         R(26, 47, 64, 1.4, '#ebeae4', ' opacity=".5"') + R(34, 53, 48, 1.4, '#ebeae4', ' opacity=".35"') + '</g>';
    o += '<g class="q-poeira">';
    [[16, 14, 36, 5], [40, 24, 44, 6], [20, 36, 30, 5], [58, 44, 38, 6], [16, 52, 40, 5], [70, 16, 28, 5], [30, 30, 24, 4]].forEach(function (b) { o += R(b[0], b[1], b[2], b[3], '#5d6a70', ' opacity=".5"'); });
    [[18, 20, 10, 1.4], [34, 31, 16, 1.4], [26, 42, 12, 1.4], [74, 24, 14, 1.4], [62, 50, 20, 1.4]].forEach(function (b) { o += R(b[0], b[1], b[2], b[3], '#ebeae4', ' opacity=".32"'); });
    o += '</g>';
    o += R(10, 70, 96, 3, '#4a3a1f') + R(22, 67, 6, 3, '#ebeae4') + R(34, 68, 4, 2, '#cfd3e6');

    /* bancada com frascos */
    o += R(8, 96, 104, 5, '#6a4a2a') + R(8, 96, 104, 1, '#8a6a35') + R(12, 101, 4, 38, '#4a3a1f') + R(104, 101, 4, 38, '#4a3a1f') + R(16, 118, 88, 2, '#4a3a1f');
    o += R(22, 122, 18, 14, '#2a2c4a') + R(24, 124, 14, 2, '#3a3d6a') + R(48, 126, 12, 10, '#3a2d27') + R(70, 120, 24, 16, '#23252f') + R(72, 124, 20, 1, '#4a4e5e');
    o += frascoPix(22, 96, '#d9534a', '#ff9a8a') + frascoPix(42, 96, '#4a90d9', '#9ac8ff') + frascoPix(62, 96, '#e8a94a', '#ffe0a0') + frascoPix(82, 96, '#6fae98', '#b7efd8');
    o += '<rect class="bolha" x="49" y="78" width="2" height="2" fill="#9ac8ff"/><rect class="bolha" x="52" y="80" width="1.5" height="1.5" fill="#9ac8ff" style="animation-delay:1.1s"/><rect class="bolha" x="69" y="78" width="2" height="2" fill="#ffe0a0" style="animation-delay:.6s"/>';
    o += R(98, 88, 8, 8, '#cfd8dc', ' opacity=".35"') + R(100, 84, 4, 4, '#cfd8dc', ' opacity=".35"');

    /* cartaz */
    o += R(188, 16, 24, 36, '#c9bf9a') + R(188, 16, 24, 1, '#e3dab8') + R(199, 16, 3, 3, '#b04a3a');
    o += '<text x="200" y="28" font-family="Share Tech Mono, monospace" font-size="4.4" fill="#2a2938" text-anchor="middle" shape-rendering="auto">SILÊNCIO</text>';
    o += R(196, 33, 3, 5, '#2a2938') + '<polygon points="199,33 204,30 204,41 199,38" fill="#2a2938"/>' + '<line x1="194" y1="43" x2="207" y2="29" stroke="#b04a3a" stroke-width="1.6"/>';
    o += '<text x="200" y="48" font-family="Share Tech Mono, monospace" font-size="3.4" fill="#4a4a5a" text-anchor="middle" shape-rendering="auto">EM CURSO</text>';

    /* relógio */
    o += '<circle cx="242" cy="34" r="18" fill="#4a3a1f"/><circle cx="242" cy="34" r="17" fill="#6a4a2a"/><circle cx="242" cy="34" r="14.5" fill="#ebeae4"/>';
    for (var h = 0; h < 12; h++) {
      var a = h * 30 * Math.PI / 180, big = h % 3 === 0;
      o += R((242 + Math.sin(a) * 12 - (big ? 1 : .6)).toFixed(1), (34 - Math.cos(a) * 12 - (big ? 1 : .6)).toFixed(1), big ? 2 : 1.2, big ? 2 : 1.2, '#1d1c26');
    }
    o += ponteiro(242, 34, 7, 320, '#1d1c26', 2) + ponteiro(242, 34, 11, 240, '#1d1c26', 1.4) + '<circle cx="242" cy="34" r="1.6" fill="#e8a94a"/>';
    o += '<g class="r-ok">' + R(232, 53, 20, 9, '#0b0c1c') + R(234, 54, 16, 7, '#ebeae4') + R(236, 56, 10, 1, '#9a9ea0') + R(236, 58, 8, 1, '#9a9ea0') + R(232, 52, 20, 1, '#8a6a35') + '</g>';

    /* cofre */
    o += R(262, 50, 48, 50, '#23252f') + R(264, 52, 44, 46, '#2e3040');
    o += '<g class="c-aberto">' + R(268, 56, 36, 38, '#0b0c1c') + '<circle cx="286" cy="75" r="22" fill="url(#gCofre)" class="luz-cofre"/>' + R(276, 70, 18, 12, '#ebeae4') + R(278, 73, 14, 1, '#9a9ea0') + R(278, 76, 10, 1, '#9a9ea0') +
         '<polygon points="268,56 256,60 256,98 268,94" fill="#4a4e5e"/><polygon points="256,60 258,62 258,96 256,98" fill="#9a9ea0"/></g>';
    o += '<g class="c-fechado">' + R(266, 54, 40, 42, '#4a4e5e') + R(269, 57, 34, 36, '#3a3d4a') + R(269, 57, 34, 1, '#5a5e70') + R(269, 92, 34, 1, '#23252f');
    [[271, 59], [298, 59], [271, 88], [298, 88]].forEach(function (b) { o += R(b[0], b[1], 2, 2, '#9a9ea0'); });
    o += '<circle cx="286" cy="75" r="10" fill="#23252f"/><circle cx="286" cy="75" r="8.5" fill="#2e3040" stroke="#9a9ea0" stroke-width="1"/>';
    for (var d = 0; d < 10; d++) { var ang = d * 36 * Math.PI / 180; o += R((286 + Math.sin(ang) * 6.8 - .5).toFixed(1), (75 - Math.cos(ang) * 6.8 - .5).toFixed(1), 1, 1, '#9a9ea0'); }
    o += R(285, 68, 2, 5, '#e8a94a') + R(295, 80, 7, 3, '#9a9ea0') + '</g>';
    o += '<g class="led-no">' + R(297, 61, 4, 4, '#ff5a4a') + '</g><g class="led-ok">' + R(297, 61, 4, 4, '#6fe39a') + '</g>';

    /* cômoda com gaveta trancada */
    o += R(226, 94, 16, 8, '#d9d6c8') + R(227, 96, 14, 1, '#9a9ea0') + R(250, 93, 8, 9, '#16282b') + R(252, 91, 4, 2, '#6fae98');
    o += R(220, 102, 74, 4, '#5a4538') + R(220, 102, 74, 1, '#7a5e4a') + R(222, 106, 70, 36, '#3b2c28');
    o += '<g class="g-fechada">' + R(226, 109, 62, 14, '#4a382f') + R(226, 109, 62, 1, '#5e463a') + R(250, 113, 14, 3, '#e8a94a') + R(254, 117, 6, 4, '#e8a94a') + R(256, 118, 2, 2, '#0b0c1c') + '</g>';
    o += '<g class="g-aberta">' + R(226, 109, 62, 3, '#0b0c1c') + R(228, 112, 58, 14, '#4a382f') + R(228, 112, 58, 1, '#5e463a') + R(238, 106, 22, 8, '#ebeae4') + R(241, 108, 14, 1, '#9a9ea0') + R(250, 119, 14, 3, '#e8a94a') + '</g>';
    o += R(226, 127, 62, 12, '#4a382f') + R(226, 127, 62, 1, '#5e463a') + R(250, 131, 14, 3, '#e8a94a');
    o += R(224, 142, 6, 3, '#2a1f1c') + R(286, 142, 6, 3, '#2a1f1c');

    /* planta */
    o += R(302, 118, 1, 14, '#5a4a2a') + R(300, 122, 1, 9, '#5a4a2a') + R(305, 124, 1, 7, '#5a4a2a');
    o += R(296, 121, 5, 2, '#6a5a2a') + R(303, 116, 5, 2, '#6a5a2a') + R(298, 126, 4, 2, '#6a5a2a') + R(306, 122, 4, 2, '#6a5a2a') + R(306, 126, 3, 2, '#6fae98');
    o += R(295, 133, 16, 2, '#8a6a35') + R(296, 135, 14, 11, '#6a4a2a') + R(297, 132, 12, 2, '#2a1f1c');

    /* mesa */
    o += R(120, 119, 5, 21, '#4a3a1f') + R(201, 119, 5, 21, '#4a3a1f') + R(120, 105, 86, 14, '#4a3a1f') + R(150, 108, 26, 8, '#3a2d17') + R(161, 111, 4, 2, '#e8a94a');
    o += R(116, 100, 94, 5, '#6a4a2a') + R(116, 100, 94, 1, '#8a6a35');
    /* livro aberto */
    o += R(127, 99, 26, 2, '#5a2a2a') + R(128, 93, 12, 7, '#ebeae4') + R(140, 93, 12, 7, '#d9d6c8') + R(139, 92, 2, 8, '#8a6a35');
    o += R(130, 95, 8, 1, '#9a9ea0') + R(130, 97, 7, 1, '#9a9ea0') + R(142, 95, 8, 1, '#9a9ea0') + R(142, 97, 6, 1, '#9a9ea0');
    /* tinteiro e xícara */
    o += R(188, 96, 5, 4, '#16282b') + R(190, 88, 1, 8, '#ebeae4') + R(191, 87, 2, 1, '#ebeae4');
    o += R(196, 94, 6, 6, '#ebeae4') + R(202, 95, 2, 3, '#ebeae4') + R(197, 95, 4, 1, '#3a2d17');
    o += '<g class="vapor"><rect x="198" y="88" width="1.5" height="3" fill="#cfd3e6"/></g><g class="vapor" style="animation-delay:1.4s"><rect x="200" y="87" width="1.5" height="3" fill="#cfd3e6"/></g>';
    /* chave caída sobre a mesa */
    o += '<g class="k-mesa"><circle cx="176" cy="97" r="2.3" fill="none" stroke="#e8a94a" stroke-width="1.2"/>' + R(178, 96.4, 7, 1.2, '#e8a94a') + R(183, 97.6, 1.2, 2, '#e8a94a') + R(185, 97.6, 1.2, 2, '#e8a94a') +
         '<g class="brilho-chave">' + R(174, 92, 1, 4, '#fff') + R(172.5, 93.5, 4, 1, '#fff') + '</g></g>';

    /* gato */
    o += '<g class="respira">' + R(58, 152, 24, 9, '#2a2c4a') + R(60, 150, 20, 3, '#2a2c4a') + R(60, 150, 20, 1, '#3a3d6a') + R(52, 153, 11, 8, '#2a2c4a') + R(52, 151, 2, 3, '#2a2c4a') + R(59, 151, 2, 3, '#2a2c4a') +
         R(80, 157, 10, 3, '#2a2c4a') + R(88, 153, 3, 6, '#2a2c4a') + R(54, 157, 3, 1, '#9a9ea0') + R(59, 157, 2, 1, '#9a9ea0') + R(52, 161, 30, 1, '#15162f', ' opacity=".6"') + '</g>';
    o += '<text class="zzz" x="60" y="148">z</text><text class="zzz" x="66" y="144" style="animation-delay:1.3s">z</text>';

    /* lâmpada e chave pendurada */
    o += '<polygon points="159,84 168,84 204,142 124,142" fill="#e8a94a" opacity=".06"/>';
    o += '<g class="lamp-g">' + R(163, 0, 1, 72, '#9a9ea0') + R(160, 70, 7, 5, '#4a4e5e') + R(161, 75, 5, 1, '#2a2c3a') +
         '<g class="luz-glow"><circle cx="163.5" cy="81" r="30" fill="url(#gLuz)"/></g><circle cx="163.5" cy="81" r="4.6" fill="#f2d27a"/><circle cx="162" cy="79.5" r="1.4" fill="#fff"/>' +
         '<g class="k-pendurada"><line x1="164" y1="52" x2="164" y2="56" stroke="#9a9ea0" stroke-width="1"/><circle cx="164" cy="58.4" r="2.4" fill="none" stroke="#e8a94a" stroke-width="1.3"/>' + R(163.4, 60.6, 1.2, 8, '#e8a94a') + R(164.6, 65.6, 2.4, 1.2, '#e8a94a') + R(164.6, 67.8, 2.4, 1.2, '#e8a94a') +
         '<g class="brilho-chave">' + R(170, 57, 1, 4, '#fff') + R(168.5, 58.5, 4, 1, '#fff') + '</g></g></g>';
    /* poeira na luz */
    [[150, 84, 0], [158, 92, 1.4], [172, 88, 2.8], [180, 98, .7], [146, 104, 4.1], [166, 100, 3.3], [190, 110, 5], [140, 96, 6], [176, 80, 2.1]].forEach(function (p) {
      o += '<rect class="poeira" x="' + p[0] + '" y="' + p[1] + '" width="1.2" height="1.2" fill="#f2d27a" style="animation-delay:' + p[2] + 's"/>';
    });
    o += '</svg>';
    return o;
  }

  /* ============================================================
     PONTOS CLICÁVEIS  (grade 320 x 180, mesma da cena)
     ============================================================ */
  var HS = [
    { id: 'janela', nome: 'Janela', x: 118, y: 12, w: 60, h: 54 },
    { id: 'quadro', nome: 'Quadro negro', x: 12, y: 10, w: 92, h: 58 },
    { id: 'frascos', nome: 'Frascos na bancada', x: 16, y: 80, w: 98, h: 21 },
    { id: 'cartaz', nome: 'Cartaz', x: 188, y: 16, w: 24, h: 36, extra: true },
    { id: 'relogio', nome: 'Relógio de parede', x: 224, y: 16, w: 36, h: 36 },
    { id: 'cofre', nome: 'Cofre', x: 262, y: 50, w: 48, h: 50 },
    { id: 'livro', nome: 'Diário do técnico', x: 126, y: 88, w: 30, h: 14 },
    { id: 'lampada', nome: 'Lâmpada', x: 154, y: 48, w: 20, h: 40 },
    { id: 'chave', nome: 'Chave de latão', x: 170, y: 90, w: 20, h: 12, oculto: true },
    { id: 'gaveta', nome: 'Gaveta', x: 226, y: 108, w: 62, h: 16 },
    { id: 'gato', nome: 'Gato', x: 52, y: 148, w: 40, h: 16, extra: true },
    { id: 'planta', nome: 'Planta', x: 294, y: 114, w: 20, h: 34, extra: true }
  ];

  /* ============================================================
     MONTAGEM DA INTERFACE
     ============================================================ */
  var ui = {};
  function montar() {
    raiz.innerHTML = '';
    /* barra superior */
    var hud = el('div', 'game-hud');
    hud.appendChild(el('div', 'hud-titulo', 'CAP. 0 · O LABORATÓRIO SILENCIOSO'));
    var pips = el('div', 'hud-pips'); pips.appendChild(document.createTextNode('Folhas '));
    ui.pips = [1, 2, 3, 4].map(function (n) { var p = el('span', 'pip', String(n)); p.title = 'Folha ' + n; pips.appendChild(p); return p; });
    hud.appendChild(pips);
    ui.extrasHud = el('span', 'hud-extra'); hud.appendChild(ui.extrasHud);
    ui.btnDica = el('button', 'hud-btn', 'Dica'); ui.btnDica.type = 'button';
    ui.btnCaderno = el('button', 'hud-btn', 'Caderno'); ui.btnCaderno.type = 'button';
    hud.appendChild(ui.btnDica); hud.appendChild(ui.btnCaderno);
    raiz.appendChild(hud);

    /* cena */
    ui.cena = el('div', 'game-scene');
    ui.cena.innerHTML = cenaSVG();
    ui.svg = ui.cena.querySelector('svg');
    ui.botoes = {};
    HS.forEach(function (h) {
      var b = el('button', 'hs' + (h.oculto ? ' oculto' : '')); b.type = 'button';
      b.setAttribute('aria-label', h.nome); b.dataset.nome = h.nome;
      b.style.left = (h.x / 320 * 100) + '%'; b.style.top = (h.y / 180 * 100) + '%';
      b.style.width = (h.w / 320 * 100) + '%'; b.style.height = (h.h / 180 * 100) + '%';
      b.addEventListener('click', function () { ultimaAcao = Date.now(); limparBrilho(); clicou(h.id, b); });
      b.addEventListener('mouseenter', function () { dica(b); });
      b.addEventListener('mousemove', function (e) { dica(b, e); });
      b.addEventListener('mouseleave', function () { ui.tip.classList.remove('on'); });
      b.addEventListener('focus', function () { dica(b); });
      b.addEventListener('blur', function () { ui.tip.classList.remove('on'); });
      ui.cena.appendChild(b); ui.botoes[h.id] = b;
    });
    ui.tip = el('div', 'game-tip'); ui.tip.setAttribute('aria-hidden', 'true'); ui.cena.appendChild(ui.tip);

    /* cartão de título */
    ui.titulo = el('div', 'game-titulo');
    raiz.appendChild(ui.cena);
    ui.cena.appendChild(ui.titulo);

    /* diálogo */
    ui.dlg = el('div', 'game-dialog');
    var ret = el('div', 'dlg-retrato'); var img = el('img'); img.src = 'assets/minigame/G.png'; img.alt = ''; ret.appendChild(img);
    var corpo = el('div', 'dlg-corpo');
    ui.nome = el('div', 'dlg-nome', 'G');
    ui.fala = el('div', 'dlg-fala'); ui.fala.setAttribute('aria-hidden', 'true');
    ui.sr = el('div', 'sr-only'); ui.sr.setAttribute('role', 'status'); ui.sr.setAttribute('aria-live', 'polite');
    ui.prox = el('button', 'dlg-prox', 'continuar ▸'); ui.prox.type = 'button'; ui.prox.hidden = true;
    corpo.appendChild(ui.nome); corpo.appendChild(ui.fala); corpo.appendChild(ui.sr);
    ui.dlg.appendChild(ret); ui.dlg.appendChild(corpo); ui.dlg.appendChild(ui.prox);
    raiz.appendChild(ui.dlg);

    ui.btnDica.addEventListener('click', pedirDica);
    ui.btnCaderno.addEventListener('click', abrirCaderno);
    ui.dlg.addEventListener('click', function () { if (digitando) pularDigitacao(); });
    atualizarCena(); atualizarHud();
    falarSimples('Clique em “Entrar no laboratório” para começar.');
    titulo();
  }
  function dica(b, e) {
    var r = ui.cena.getBoundingClientRect(), br = b.getBoundingClientRect();
    ui.tip.textContent = b.dataset.nome;
    ui.tip.style.left = (e ? e.clientX - r.left : br.left - r.left + br.width / 2) + 'px';
    ui.tip.style.top = (e ? e.clientY - r.top : br.top - r.top) + 'px';
    ui.tip.classList.add('on');
  }

  function titulo() {
    ui.titulo.className = 'game-titulo'; ui.titulo.innerHTML = '';
    var c = el('div', 'titulo-in');
    var feito = concluido();
    c.appendChild(el('div', 'k', feito ? 'Cofre aberto' : (S.iniciou && nFolhas() ? 'Investigação em andamento' : 'Capítulo 0')));
    c.appendChild(el('h3', null, feito ? 'Demo liberada!' : 'O laboratório silencioso'));
    c.appendChild(el('p', null, feito
      ? 'Você já abriu o cofre. A demo está esperando por você logo abaixo, no final da página.'
      : 'Encontre as 4 folhas, resolva os enigmas e abra o cofre para liberar a demo.'));
    var ac = el('div', 'titulo-acoes');
    if (feito) {
      var a = el('a', 'btn', 'Ir para a demo'); a.href = '#demo'; ac.appendChild(a);
      var r = el('button', 'btn btn-sec', 'Jogar de novo'); r.type = 'button'; r.addEventListener('click', reiniciar); ac.appendChild(r);
    } else {
      var b = el('button', 'btn', S.iniciou && nFolhas() ? 'Continuar investigação' : 'Entrar no laboratório'); b.type = 'button';
      b.addEventListener('click', comecar); ac.appendChild(b);
      if (S.iniciou && (nFolhas() || S.lampada)) { var n = el('button', 'btn btn-sec', 'Recomeçar do zero'); n.type = 'button'; n.addEventListener('click', reiniciar); ac.appendChild(n); }
    }
    c.appendChild(ac);
    var aj = el('div', 'titulo-ajuda');
    ['Clique nos objetos', 'Botão “Dica” sempre disponível', 'Esc fecha as janelas'].forEach(function (t) { aj.appendChild(el('span', null, '▪ ' + t)); });
    c.appendChild(aj);
    ui.titulo.appendChild(c);
    var alvo = ui.titulo.querySelector('button, a'); if (alvo) setTimeout(function () { try { alvo.focus({ preventScroll: true }); } catch (e) { } }, 50);
  }
  function comecar() {
    ui.titulo.classList.add('some'); setTimeout(function () { ui.titulo.style.display = 'none'; }, 520);
    var primeira = !S.iniciou || (!nFolhas() && !S.lampada);
    S.iniciou = true; passo.t0 = Date.now(); ultimaAcao = Date.now(); salvar();
    if (primeira) falar(TEXTOS.intro); else falarSimples('De volta ao laboratório. Onde eu estava mesmo?');
  }
  function reiniciar() {
    apagarSalvo(); S = estadoNovo(); passo = { n: {}, t0: 0 };
    if (window.Gate && window.Gate.liberado()) window.Gate.travar();
    ui.titulo.style.display = ''; montar();
  }

  function atualizarHud() {
    ui.pips.forEach(function (p, i) {
      var id = ['quadro', 'frascos', 'gaveta', 'relogio'][i];
      var d = S.folhas[id];
      p.textContent = d !== undefined ? d : String(i + 1);
      p.classList.toggle('cheio', d !== undefined);
    });
    var ex = Object.keys(S.extras).length;
    ui.extrasHud.textContent = ex ? '★ ' + ex + '/3' : '';
    ui.extrasHud.title = 'Curiosidades encontradas';
  }
  function atualizarCena() {
    var c = ui.svg.classList;
    c.toggle('s-lampada', S.lampada); c.toggle('s-chave', S.chave);
    c.toggle('s-quadro', S.folhas.quadro !== undefined); c.toggle('s-relogio', S.folhas.relogio !== undefined);
    c.toggle('s-gaveta', S.gavetaAberta); c.toggle('s-cofre', concluido());
    ui.botoes.chave.classList.toggle('oculto', !(S.lampada && !S.chave));
    var feitos = { quadro: S.folhas.quadro !== undefined, frascos: S.folhas.frascos !== undefined, relogio: S.folhas.relogio !== undefined,
      gaveta: S.folhas.gaveta !== undefined, lampada: S.lampada, livro: S.livro, cofre: concluido(), cartaz: !!S.extras.cartaz, gato: !!S.extras.gato, planta: !!S.extras.planta };
    Object.keys(feitos).forEach(function (k) { ui.botoes[k].classList.toggle('feito', !!feitos[k]); });
  }

  /* ---------------- diálogo (efeito de máquina de escrever) ---------------- */
  var fila = [], digitando = null, textoAtual = '';
  function falarSimples(t, quem) { fila = []; escrever(t, quem); ui.prox.hidden = true; }
  function falar(linhas, quem) {
    fila = linhas.slice();
    proximaLinha(quem);
  }
  function proximaLinha(quem) {
    var t = fila.shift(); if (t === undefined) { ui.prox.hidden = true; return; }
    escrever(t, quem);
    if (fila.length) {
      ui.prox.hidden = false;
      ui.prox.onclick = function (e) { e.stopPropagation(); if (digitando) pularDigitacao(); else proximaLinha(quem); };
    } else ui.prox.hidden = true;
  }
  function escrever(t, quem) {
    if (digitando) { clearInterval(digitando); digitando = null; }
    textoAtual = t;
    ui.nome.innerHTML = ''; ui.nome.appendChild(document.createTextNode('G'));
    if (quem) ui.nome.appendChild(el('small', null, quem));
    ui.sr.textContent = t;
    if (reduzir) { ui.fala.textContent = t; ui.dlg.classList.remove('falando'); return; }
    var i = 0; ui.fala.textContent = ''; ui.dlg.classList.add('falando');
    digitando = setInterval(function () {
      i += 1; ui.fala.textContent = t.slice(0, i);
      if (i >= t.length) { clearInterval(digitando); digitando = null; ui.dlg.classList.remove('falando'); }
    }, 16);
  }
  function pularDigitacao() {
    if (!digitando) return;
    clearInterval(digitando); digitando = null; ui.fala.textContent = textoAtual; ui.dlg.classList.remove('falando');
  }

  /* ---------------- painéis ---------------- */
  var painelAtual = null, focoAntes = null;
  function painel(o) {
    var anterior = painelAtual ? focoAntes : document.activeElement;
    fecharPainel(true);
    focoAntes = anterior;
    var fundo = el('div', 'painel-fundo'); fundo.setAttribute('role', 'dialog'); fundo.setAttribute('aria-modal', 'true'); fundo.setAttribute('aria-label', o.titulo);
    var p = el('div', 'painel ' + (o.classe || ''));
    var topo = el('div', 'painel-topo');
    if (!o.semTitulo) topo.appendChild(el('h3', null, o.titulo));
    var x = el('button', 'painel-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', function () { fecharPainel(); });
    if (o.semTitulo) { p.appendChild(x); } else { topo.appendChild(x); p.appendChild(topo); }
    p.appendChild(o.corpo);
    fundo.appendChild(p);
    var abertoEm = Date.now();
    fundo.addEventListener('mousedown', function (e) { if (e.target === fundo && Date.now() - abertoEm > 600) fecharPainel(); });
    document.body.appendChild(fundo);
    document.documentElement.classList.add('game-aberto');
    painelAtual = { fundo: fundo, aoFechar: o.aoFechar };
    document.addEventListener('keydown', teclaPainel);
    var f = o.foco ? p.querySelector(o.foco) : null; (f || x).focus({ preventScroll: true });
    return painelAtual;
  }
  function teclaPainel(e) {
    if (e.key === 'Escape') { fecharPainel(); return; }
    if (e.key === 'Tab' && painelAtual) {
      var f = painelAtual.fundo.querySelectorAll('button:not([disabled]), [tabindex="0"], input, a[href]');
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }
  function fecharPainel(semFoco) {
    if (!painelAtual) return;
    var p = painelAtual; painelAtual = null;
    p.fundo.remove(); document.removeEventListener('keydown', teclaPainel);
    document.documentElement.classList.remove('game-aberto');
    if (p.aoFechar) p.aoFechar();
    if (!semFoco && focoAntes && focoAntes.focus && document.contains(focoAntes)) focoAntes.focus({ preventScroll: true });
  }
  function msgLinha(corpo) { var m = el('div', 'msg'); m.setAttribute('role', 'status'); corpo.appendChild(m); return function (t, erro) { m.textContent = t; m.className = 'msg' + (erro ? ' erro' : ''); }; }

  /* ---------------- etapas: pede ao servidor o dígito ---------------- */
  function resolver(id, resposta) {
    return api('etapa', { id: id, resposta: resposta }).then(function (r) {
      if (r.erroRede) return { rede: r.erroRede };
      if (!r.ok) return { errou: true };
      S.folhas[id] = String(r.digito);
      salvar(); atualizarHud(); atualizarCena();
      var pip = ui.pips[TEXTOS.folhas[id].n - 1]; pip.classList.remove('novo'); void pip.offsetWidth; pip.classList.add('novo');
      return { ok: true, digito: String(r.digito) };
    });
  }

  /* ---------------- a folha de papel ---------------- */
  function abrirFolha(id, depoisFechar) {
    var f = TEXTOS.folhas[id]; var d = S.folhas[id];
    var corpo = el('div', 'folha');
    corpo.appendChild(el('div', 'folha-k', f.k));
    corpo.appendChild(el('h4', null, f.titulo));
    corpo.appendChild(el('p', null, f.texto));
    var msg = null;
    if (id === 'gaveta' && d === undefined) {
      corpo.appendChild(el('p', 'pergunta', f.pergunta));
      var cont = el('div', 'contador'), n = 0;
      var menos = el('button', null, '−'), mais = el('button', null, '+'); menos.type = mais.type = 'button';
      menos.setAttribute('aria-label', 'Diminuir'); mais.setAttribute('aria-label', 'Aumentar');
      var out = el('output', null, '0'); out.setAttribute('aria-live', 'polite');
      menos.addEventListener('click', function () { n = Math.max(0, n - 1); out.textContent = n; });
      mais.addEventListener('click', function () { n = Math.min(40, n + 1); out.textContent = n; });
      cont.appendChild(menos); cont.appendChild(out); cont.appendChild(mais);
      var resp = el('button', 'btn', 'Responder'); resp.type = 'button';
      cont.appendChild(resp); corpo.appendChild(cont);
      msg = msgLinha(corpo);
      resp.addEventListener('click', function () {
        resp.disabled = true;
        resolver('gaveta', n).then(function (r) {
          resp.disabled = false;
          if (r.rede) { msg(r.rede, true); return; }
          if (r.errou) { msg('Hmm… não bate. Conte de novo: só as janelas ACESAS (âmbar).', true); return; }
          fecharPainel(true); abrirFolha('gaveta');
          falarSimples('Nove! Agora faz sentido. Folha 3 anotada: o dígito é ' + r.digito + '.');
        });
      });
    } else {
      if (id === 'gaveta') corpo.appendChild(el('p', null, f.depois));
      if (d !== undefined) {
        var p = el('p'); p.appendChild(document.createTextNode('Dígito: ')); p.appendChild(el('span', 'dig', d)); corpo.appendChild(p);
      }
    }
    painel({ titulo: f.titulo, corpo: corpo, classe: 'p-folha', semTitulo: true, aoFechar: depoisFechar });
  }

  /* ---------------- quadro negro: limpar a poeira com o mouse ---------------- */
  function abrirQuadro() {
    var corpo = el('div');
    corpo.appendChild(el('p', 'dica-p', 'O giz está coberto de poeira. Arraste o mouse (ou o dedo) por cima para limpar.'));
    var wrap = el('div', 'quadro-wrap');
    var giz = el('div', 'quadro-giz'); giz.setAttribute('aria-hidden', 'true');
    giz.appendChild(el('div', 'g1', 'ALA 7')); giz.appendChild(el('div', 'g2', 'a experiência começou aqui')); giz.appendChild(el('div', 'g3', '→ ordem: 1 · 2 · 3 · 4 ←'));
    var cv = el('canvas'); cv.setAttribute('aria-hidden', 'true');
    wrap.appendChild(giz); wrap.appendChild(cv); corpo.appendChild(wrap);
    var barra = el('div', 'barra'); var prog = el('i'); barra.appendChild(prog); corpo.appendChild(barra);
    var acoes = el('div', 'painel-acoes'); var alt = el('button', 'btn btn-sec', 'Passar o apagador (sem arrastar)'); alt.type = 'button'; acoes.appendChild(alt); corpo.appendChild(acoes);
    var msg = msgLinha(corpo);
    var concluiu = false;
    var p = painel({ titulo: 'Quadro negro', corpo: corpo, foco: '.btn-sec' });

    var ctx = cv.getContext('2d'), W = 0, H = 0, COLS = 24, ROWS = 14, tocadas = {}, qtd = 0;
    function ajustar() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth; H = wrap.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#6b767c'; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 900; i++) { ctx.fillStyle = 'rgba(' + (150 + Math.random() * 80 | 0) + ',' + (160 + Math.random() * 70 | 0) + ',' + (165 + Math.random() * 70 | 0) + ',' + (0.25 + Math.random() * .4) + ')'; ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 3); }
    }
    ajustar();
    function marcar(x, y, raio) {
      var c0 = Math.max(0, Math.floor((x - raio) / W * COLS)), c1 = Math.min(COLS - 1, Math.floor((x + raio) / W * COLS));
      var r0 = Math.max(0, Math.floor((y - raio) / H * ROWS)), r1 = Math.min(ROWS - 1, Math.floor((y + raio) / H * ROWS));
      for (var c = c0; c <= c1; c++) for (var r = r0; r <= r1; r++) { var k = c + ',' + r; if (!tocadas[k]) { tocadas[k] = 1; qtd++; } }
      var pct = Math.min(1, qtd / (COLS * ROWS * 0.62)); prog.style.width = (pct * 100) + '%';
      if (pct >= 1) terminar();
    }
    function limpar(x, y, x0, y0) {
      var raio = Math.max(18, W * 0.055);
      ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineWidth = raio * 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
      marcar(x, y, raio * .9);
    }
    var down = false, lx = 0, ly = 0;
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
    cv.addEventListener('pointerdown', function (e) { down = true; cv.setPointerCapture(e.pointerId); var q = pos(e); lx = q[0]; ly = q[1]; limpar(lx, ly, lx, ly); });
    cv.addEventListener('pointermove', function (e) { if (!down || concluiu) return; var q = pos(e); limpar(q[0], q[1], lx, ly); lx = q[0]; ly = q[1]; });
    cv.addEventListener('pointerup', function () { down = false; });
    cv.addEventListener('pointercancel', function () { down = false; });
    alt.addEventListener('click', function () {
      alt.disabled = true; var t = 0;
      (function varrer() {
        t += 1; var y = (t % 8) / 8 * H + H / 16, x = (Math.floor(t / 8) % 2 ? W : 0), x2 = (Math.floor(t / 8) % 2 ? 0 : W);
        limpar(x2, y, x, y);
        if (!concluiu && t < 40) setTimeout(varrer, reduzir ? 0 : 40);
      })();
    });
    function terminar() {
      if (concluiu) return; concluiu = true; cv.classList.add('fim'); giz.removeAttribute('aria-hidden'); msg('Limpo! Dá pra ler tudo.');
      pausa(900).then(function () { return resolver('quadro', 'limpo'); }).then(function (r) {
        if (r.rede) { msg(r.rede, true); concluiu = false; return; }
        fecharPainel(true); abrirFolha('quadro');
        falarSimples('Ala 7… Folha 1 anotada. O dígito é ' + r.digito + '.');
      });
    }
  }

  /* ---------------- frascos: ordem do mais frio ao mais quente ---------------- */
  var COR_FRASCO = { vermelho: ['#d9534a', '#ff9a8a'], azul: ['#4a90d9', '#9ac8ff'], ambar: ['#e8a94a', '#ffe0a0'], verde: ['#6fae98', '#b7efd8'] };
  var NOME_FRASCO = { vermelho: 'Vermelho', azul: 'Azul', ambar: 'Âmbar', verde: 'Verde' };
  function frascoGrande(cor) {
    var c = COR_FRASCO[cor];
    return '<svg viewBox="0 0 12 16" shape-rendering="crispEdges" aria-hidden="true">' +
      R(4, 0, 4, 1.4, '#9a9ea0') + R(4, 1, 4, 4, '#cfd8dc', ' opacity=".5"') + R(3, 5, 6, 2, '#cfd8dc', ' opacity=".45"') + R(1, 7, 10, 2, '#cfd8dc', ' opacity=".45"') + R(0, 9, 12, 7, '#cfd8dc', ' opacity=".45"') +
      R(3, 6, 6, 2, c[0]) + R(1, 8, 10, 2, c[0]) + R(1, 10, 10, 5, c[0]) + R(2, 10, 2, 4, c[1], ' opacity=".75"') + R(0, 15, 12, 1, '#0d0e1a', ' opacity=".4"') + '</svg>';
  }
  function abrirFrascos() {
    var corpo = el('div');
    corpo.appendChild(el('p', 'dica-p', 'Acione os frascos um por um, na ordem certa. Escolha com calma: errar só reinicia a sequência.'));
    var linha = el('div', 'frascos-linha'); var botoes = [];
    ['vermelho', 'azul', 'ambar', 'verde'].forEach(function (cor) {
      var b = el('button', 'frasco-b'); b.type = 'button'; b.dataset.cor = cor; b.innerHTML = frascoGrande(cor); b.appendChild(el('span', null, NOME_FRASCO[cor]));
      b.setAttribute('aria-label', 'Frasco ' + NOME_FRASCO[cor]); linha.appendChild(b); botoes.push(b);
    });
    corpo.appendChild(linha);
    var seq = el('div', 'seq'); var slots = [1, 2, 3, 4].map(function (n) { var s = el('div', 'seq-slot', n + 'º'); seq.appendChild(s); return s; });
    corpo.appendChild(seq);
    var acoes = el('div', 'painel-acoes'); var rec = el('button', 'btn btn-sec', 'Recomeçar sequência'); rec.type = 'button'; acoes.appendChild(rec); corpo.appendChild(acoes);
    var msg = msgLinha(corpo);
    var escolha = [], trava = false;
    function desenhar() {
      slots.forEach(function (s, i) {
        var c = escolha[i]; s.className = 'seq-slot' + (c ? ' cheio' : ''); s.style.background = c ? COR_FRASCO[c][0] : ''; s.textContent = c ? NOME_FRASCO[c].slice(0, 3) : (i + 1) + 'º';
      });
      botoes.forEach(function (b) { b.disabled = escolha.indexOf(b.dataset.cor) !== -1 || trava; });
    }
    botoes.forEach(function (b) {
      b.addEventListener('click', function () {
        if (trava) return; escolha.push(b.dataset.cor); desenhar(); msg('');
        if (escolha.length === 4) {
          trava = true; desenhar();
          resolver('frascos', escolha.slice()).then(function (r) {
            if (r.rede) { msg(r.rede, true); trava = false; escolha = []; desenhar(); return; }
            if (r.errou) {
              seq.classList.remove('erro'); void seq.offsetWidth; seq.classList.add('erro');
              msg('Os frascos esfriam sem reagir. Hmm, será que o diário diz a ordem?', true);
              pausa(800).then(function () { escolha = []; trava = false; desenhar(); }); return;
            }
            seq.classList.add('ok'); msg('Clique! Um compartimento secreto se abriu atrás da bancada.');
            pausa(1100).then(function () { fecharPainel(true); abrirFolha('frascos'); falarSimples('Frio, morno, quente, fervendo. Folha 2 anotada: dígito ' + r.digito + '.'); });
          });
        }
      });
    });
    rec.addEventListener('click', function () { escolha = []; trava = false; msg(''); desenhar(); });
    desenhar();
    painel({ titulo: 'Bancada de frascos', corpo: corpo, foco: '.frasco-b' });
  }

  /* ---------------- diário do técnico ---------------- */
  function abrirLivro() {
    S.livro = true; salvar(); atualizarCena();
    var corpo = el('div', 'livro-wrap'); var pagina = el('div', 'folha'); var nav = el('div', 'livro-nav');
    var ant = el('button', 'btn btn-sec', '◂ Anterior'), prox = el('button', 'btn btn-sec', 'Próxima ▸'), num = el('span');
    ant.type = prox.type = 'button'; nav.appendChild(ant); nav.appendChild(num); nav.appendChild(prox);
    corpo.appendChild(pagina); corpo.appendChild(nav);
    var i = 0;
    function ir(n) {
      i = Math.max(0, Math.min(TEXTOS.diario.length - 1, n)); var d = TEXTOS.diario[i];
      pagina.innerHTML = ''; pagina.appendChild(el('div', 'folha-k', 'Diário do técnico')); pagina.appendChild(el('h4', null, d.t)); pagina.appendChild(el('p', null, d.x));
      pagina.classList.remove('virar'); void pagina.offsetWidth; pagina.classList.add('virar');
      num.textContent = (i + 1) + ' / ' + TEXTOS.diario.length; ant.disabled = i === 0; prox.disabled = i === TEXTOS.diario.length - 1;
    }
    ant.addEventListener('click', function () { ir(i - 1); }); prox.addEventListener('click', function () { ir(i + 1); });
    var teclas = function (e) { if (e.key === 'ArrowLeft') ir(i - 1); if (e.key === 'ArrowRight') ir(i + 1); };
    document.addEventListener('keydown', teclas);
    ir(0);
    painel({ titulo: 'Diário do técnico', corpo: corpo, foco: '.btn-sec:not([disabled])', aoFechar: function () { document.removeEventListener('keydown', teclas); } });
  }

  /* ---------------- relógio ---------------- */
  function abrirRelogio() {
    var corpo = el('div');
    corpo.appendChild(el('p', 'dica-p', 'O relógio tem uma trava escondida. Escolha o ponteiro e clique no número do mostrador.'));
    var box = el('div', 'relogio-box'); var face = el('div', 'relogio-face');
    var svg = '<svg viewBox="0 0 100 100" shape-rendering="geometricPrecision" aria-hidden="true"><circle cx="50" cy="50" r="49" fill="#4a3a1f"/><circle cx="50" cy="50" r="46" fill="#6a4a2a"/><circle cx="50" cy="50" r="41" fill="#ebeae4"/>';
    for (var i = 0; i < 60; i++) { var a = i * 6 * Math.PI / 180, l = i % 5 === 0 ? 4 : 2; svg += '<line x1="' + (50 + Math.sin(a) * 40) + '" y1="' + (50 - Math.cos(a) * 40) + '" x2="' + (50 + Math.sin(a) * (40 - l)) + '" y2="' + (50 - Math.cos(a) * (40 - l)) + '" stroke="#1d1c26" stroke-width="' + (i % 5 === 0 ? 1.2 : .5) + '"/>'; }
    svg += '<g id="mh"></g><g id="mm"></g><circle cx="50" cy="50" r="3" fill="#e8a94a"/></svg>';
    face.innerHTML = svg; var gh = face.querySelector('#mh'), gm = face.querySelector('#mm');
    var hora = 10, min = 40, modo = 'h';
    function pontas() {
      var ah = ((hora % 12) + min / 60) * 30, am = min * 6;
      gh.innerHTML = '<line x1="50" y1="50" x2="' + (50 + Math.sin(ah * Math.PI / 180) * 22) + '" y2="' + (50 - Math.cos(ah * Math.PI / 180) * 22) + '" stroke="#1d1c26" stroke-width="3.4" stroke-linecap="square"/>';
      gm.innerHTML = '<line x1="50" y1="50" x2="' + (50 + Math.sin(am * Math.PI / 180) * 33) + '" y2="' + (50 - Math.cos(am * Math.PI / 180) * 33) + '" stroke="#b04a3a" stroke-width="2" stroke-linecap="square"/>';
      leitura.textContent = dois(hora) + ':' + dois(min);
    }
    for (var n = 1; n <= 12; n++) (function (n) {
      var b = el('button', 'num', String(n)); b.type = 'button'; var ang = n * 30 * Math.PI / 180;
      b.style.left = (50 + Math.sin(ang) * 31) + '%'; b.style.top = (50 - Math.cos(ang) * 31) + '%';
      b.setAttribute('aria-label', n + (modo === 'h' ? '' : '')); b.addEventListener('click', function () {
        if (modo === 'h') hora = n; else min = (n % 12) * 5; pontas(); msg('');
      }); face.appendChild(b);
    })(n);
    var ctrl = el('div', 'relogio-ctrl'); var leitura = el('div', 'relogio-hora', '10:40'); leitura.setAttribute('aria-live', 'polite');
    var mod = el('div', 'modo'); var bh = el('button', null, 'Horas'), bm = el('button', null, 'Minutos'); bh.type = bm.type = 'button';
    function setModo(m) { modo = m; bh.setAttribute('aria-pressed', m === 'h'); bm.setAttribute('aria-pressed', m === 'm'); }
    bh.addEventListener('click', function () { setModo('h'); }); bm.addEventListener('click', function () { setModo('m'); });
    mod.appendChild(bh); mod.appendChild(bm); setModo('h');
    var ok = el('button', 'btn', 'Ajustar relógio'); ok.type = 'button';
    ctrl.appendChild(leitura); ctrl.appendChild(mod); ctrl.appendChild(el('p', 'dica-p', 'Minutos: o 1 vale 5 min, o 2 vale 10 min…')); ctrl.appendChild(ok);
    box.appendChild(face); box.appendChild(ctrl); corpo.appendChild(box);
    var msg = msgLinha(corpo); pontas();
    ok.addEventListener('click', function () {
      ok.disabled = true;
      resolver('relogio', { h: hora, m: min }).then(function (r) {
        ok.disabled = false;
        if (r.rede) { msg(r.rede, true); return; }
        if (r.errou) { msg('Nada acontece. A trava só cede na hora exata. O diário ajuda.', true); return; }
        msg('Clique! O fundo do relógio se abriu.');
        pausa(900).then(function () { fecharPainel(true); abrirFolha('relogio'); falarSimples('Quatro horas e dez. Folha 4 anotada: dígito ' + r.digito + '.'); });
      });
    });
    painel({ titulo: 'Relógio de parede', corpo: corpo, foco: '.modo button' });
  }

  /* ---------------- janela: contar as janelas acesas ---------------- */
  function abrirJanela() {
    var corpo = el('div');
    corpo.appendChild(el('p', 'dica-p', 'A vila lá fora. Clique nas janelas para marcá-las e ajudar a contar. As ACESAS brilham em âmbar.'));
    var w = el('div', 'cidade-wrap');
    w.innerHTML = '<svg viewBox="0 0 120 108" shape-rendering="crispEdges" role="group" aria-label="Vila à noite, com janelas acesas e apagadas">' + cidadeSVG(true) + '</svg>';
    corpo.appendChild(w);
    var info = el('div', 'cidade-info'); info.appendChild(document.createTextNode('Janelas marcadas:')); var out = el('output', null, '0'); info.appendChild(out);
    var lim = el('button', 'btn btn-sec', 'Limpar marcas'); lim.type = 'button'; info.appendChild(lim); corpo.appendChild(info);
    var marcadas = 0;
    function alternar(g) {
      var on = !g.classList.contains('on'); g.classList.toggle('on', on); g.setAttribute('aria-pressed', on); marcadas += on ? 1 : -1; out.textContent = marcadas;
    }
    Array.prototype.forEach.call(w.querySelectorAll('.jan'), function (g) {
      g.addEventListener('click', function () { alternar(g); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(g); } });
    });
    lim.addEventListener('click', function () { Array.prototype.forEach.call(w.querySelectorAll('.jan.on'), function (g) { g.classList.remove('on'); g.setAttribute('aria-pressed', 'false'); }); marcadas = 0; out.textContent = '0'; });
    painel({ titulo: 'Pela janela', corpo: corpo, foco: '.jan' });
  }

  /* ---------------- cofre ---------------- */
  function abrirCofre() {
    var corpo = el('div', 'cofre-box');
    corpo.appendChild(el('p', 'dica-p', 'Quatro dígitos. Use as setas, o teclado ou clique nos botões.'));
    var c = el('div', 'cofre-corpo'); var led = el('div', 'led'); c.appendChild(led);
    var dials = el('div', 'dials'); var vals = [0, 0, 0, 0], ds = [];
    [0, 1, 2, 3].forEach(function (i) {
      var col = el('div', 'dial-col'); var cima = el('button', null, '▲'), baixo = el('button', null, '▼'); cima.type = baixo.type = 'button'; cima.tabIndex = baixo.tabIndex = -1;
      cima.setAttribute('aria-label', 'Aumentar dígito ' + (i + 1)); baixo.setAttribute('aria-label', 'Diminuir dígito ' + (i + 1));
      var d = el('div', 'dial', '0'); d.tabIndex = 0; d.setAttribute('role', 'spinbutton'); d.setAttribute('aria-label', 'Dígito ' + (i + 1)); d.setAttribute('aria-valuemin', '0'); d.setAttribute('aria-valuemax', '9'); d.setAttribute('aria-valuenow', '0');
      function set(v) { vals[i] = (v + 10) % 10; d.textContent = vals[i]; d.setAttribute('aria-valuenow', vals[i]); d.classList.remove('roda'); void d.offsetWidth; d.classList.add('roda'); }
      cima.addEventListener('click', function () { set(vals[i] + 1); }); baixo.addEventListener('click', function () { set(vals[i] - 1); });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); set(vals[i] + 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); set(vals[i] - 1); }
        else if (/^\d$/.test(e.key)) { e.preventDefault(); set(+e.key); if (ds[i + 1]) ds[i + 1].focus(); }
        else if (e.key === 'Backspace' && ds[i - 1]) { set(0); ds[i - 1].focus(); }
        else if (e.key === 'Enter') abrir.click();
      });
      col.appendChild(el('span', null, 'FOLHA ' + (i + 1))); col.appendChild(cima); col.appendChild(d); col.appendChild(baixo); dials.appendChild(col); ds.push(d);
    });
    c.appendChild(dials); corpo.appendChild(c);
    var notas = el('div', 'notas-cofre');
    ['quadro', 'frascos', 'gaveta', 'relogio'].forEach(function (id, i) { notas.appendChild(el('span', S.folhas[id] !== undefined ? 'ok' : '', 'Folha ' + (i + 1) + ': ' + (S.folhas[id] !== undefined ? S.folhas[id] : '?'))); });
    corpo.appendChild(notas);
    var abrir = el('button', 'btn', 'Abrir cofre'); abrir.type = 'button'; corpo.appendChild(abrir);
    var msg = msgLinha(corpo);
    abrir.addEventListener('click', function () {
      abrir.disabled = true; msg('Girando…');
      api('cofre', { codigo: vals.join('') }).then(function (r) {
        abrir.disabled = false;
        if (r.erroRede) { msg(r.erroRede, true); return; }
        if (!r.ok) {
          led.className = 'led no'; dials.classList.remove('erro'); void dials.offsetWidth; dials.classList.add('erro');
          msg('Trancado. Os dígitos seguem a ordem das folhas: 1, 2, 3, 4.', true);
          pausa(900).then(function () { led.className = 'led'; }); return;
        }
        led.className = 'led ok'; msg('Destravado!');
        abrir.disabled = true;
        pausa(900).then(function () { fecharPainel(true); finalizar(r); });
      });
    });
    painel({ titulo: 'Cofre', corpo: corpo, foco: '.dial' });
  }

  /* ---------------- final ---------------- */
  function brasas() {
    if (reduzir) return;
    for (var i = 0; i < 34; i++) {
      var b = el('div', 'brasa'); var ang = Math.random() * Math.PI * 2, d = 60 + Math.random() * 220;
      b.style.left = '87%'; b.style.top = '42%'; b.style.setProperty('--dx', (Math.cos(ang) * d) + 'px'); b.style.setProperty('--dy', (Math.sin(ang) * d - 40) + 'px'); b.style.animationDelay = (Math.random() * .25) + 's';
      ui.cena.appendChild(b); (function (x) { setTimeout(function () { x.remove(); }, 2300); })(b);
    }
  }
  function finalizar(r) {
    var ms = tempoAtual();
    window.Gate.liberar(r.token, r.expira, 'ao-ver');
    atualizarCena();
    ui.cena.classList.add('flash'); setTimeout(function () { ui.cena.classList.remove('flash'); }, 900); brasas();
    falar(TEXTOS.final);
    var corpo = el('div', 'final-box');
    corpo.appendChild(el('div', 'k', 'CAPÍTULO 0 CONCLUÍDO'));
    var seg = Math.round(ms / 1000), tempo = Math.floor(seg / 60) + ':' + dois(seg % 60);
    var rank = seg < 240 ? 'Olhos de Águia' : seg < 480 ? 'Detetive' : 'Investigador Paciente';
    var ex = Object.keys(S.extras).length;
    corpo.appendChild(el('div', 'selo', rank + (ex === 3 ? ' ★' : '')));
    corpo.appendChild(el('p', 'dica-p', 'No cofre, um bilhete: “Quem chegou até aqui merece jogar primeiro.” O acesso antecipado à demo está liberado para você.'));
    var dl = el('dl', 'final-stats');
    [['Tempo', tempo], ['Dicas usadas', String(S.dicas)], ['Curiosidades', ex + '/3']].forEach(function (p) { var d = el('div'); d.appendChild(el('dt', null, p[0])); d.appendChild(el('dd', null, p[1])); dl.appendChild(d); });
    corpo.appendChild(dl);
    var ac = el('div', 'painel-acoes'); var ir = el('a', 'btn', 'Liberar minha demo'); ir.href = '#demo'; ir.addEventListener('click', function () { fecharPainel(true); });
    var rep = el('button', 'btn btn-sec', 'Jogar de novo'); rep.type = 'button'; rep.addEventListener('click', function () { fecharPainel(true); reiniciar(); });
    ac.appendChild(ir); ac.appendChild(rep); corpo.appendChild(ac);
    setTimeout(function () { painel({ titulo: 'O cofre abriu!', corpo: corpo, foco: 'a.btn' }); }, reduzir ? 50 : 1300);
    salvar();
  }

  /* ---------------- caderno ---------------- */
  function abrirCaderno() {
    var corpo = el('div');
    corpo.appendChild(el('p', 'dica-p', 'Tudo o que já descobri. O código do cofre usa os dígitos na ordem das folhas.'));
    var ul = el('ul', 'caderno-lista');
    ['quadro', 'frascos', 'gaveta', 'relogio'].forEach(function (id) {
      var f = TEXTOS.folhas[id], d = S.folhas[id]; var li = el('li', d !== undefined ? 'ok' : '');
      li.appendChild(el('div', 'n', d !== undefined ? d : String(f.n)));
      var t = el('div', 't', d !== undefined ? f.titulo : 'Folha ' + f.n + ' · ainda não encontrada'); if (d !== undefined) t.appendChild(el('small', null, 'Folha ' + f.n));
      li.appendChild(t);
      if (d !== undefined) { var b = el('button', null, 'Reler'); b.type = 'button'; b.addEventListener('click', function () { fecharPainel(true); abrirFolha(id); }); li.appendChild(b); }
      ul.appendChild(li);
    });
    var li = el('li', S.chave ? 'ok' : ''); li.appendChild(el('div', 'n', S.chave ? '✓' : '?')); li.appendChild(el('div', 't', S.chave ? 'Chave de latão' : 'Chave · ainda não encontrada')); ul.appendChild(li);
    var ex = Object.keys(S.extras).length; li = el('li', ex === 3 ? 'ok' : ''); li.appendChild(el('div', 'n', '★')); li.appendChild(el('div', 't', 'Curiosidades: ' + ex + ' de 3')); ul.appendChild(li);
    corpo.appendChild(ul);
    if (S.livro) { var l = el('div', 'painel-acoes'); var b2 = el('button', 'btn btn-sec', 'Reler o diário'); b2.type = 'button'; b2.addEventListener('click', function () { fecharPainel(true); abrirLivro(); }); l.appendChild(b2); corpo.appendChild(l); }
    painel({ titulo: 'Caderno', corpo: corpo });
  }

  /* ---------------- dicas (ilimitadas, sem punição) ---------------- */
  var DICAS = [
    { quando: function () { return S.folhas.quadro === undefined; }, id: 'quadro', t: ['O quadro negro está coberto de poeira de giz. Dá pra limpar.', 'Clique no quadro e arraste o mouse sobre a poeira. Se preferir, tem um botão para passar o apagador.'] },
    { quando: function () { return !S.livro; }, id: 'livro', t: ['Aquele livro aberto na mesa parece um diário. Pode ter instruções.', 'Clique no diário e leia todas as páginas. Ele ajuda com os frascos, o relógio e a chave.'] },
    { quando: function () { return !S.lampada; }, id: 'lampada', t: ['Tem algo brilhando preso no fio da lâmpada.', 'Clique na lâmpada para puxar o fio. A chave vai cair na mesa.'] },
    { quando: function () { return S.lampada && !S.chave; }, id: 'chave', t: ['A chave caiu em cima da mesa. Ela brilha.', 'Clique na chave de latão perto da xícara.'] },
    { quando: function () { return S.folhas.frascos === undefined; }, id: 'frascos', t: ['Os frascos da bancada reagem em uma ordem específica. O diário explica.', 'Do mais frio ao mais quente. Comece pelo azul.', 'Ordem: azul, verde, âmbar, vermelho.'] },
    { quando: function () { return S.folhas.relogio === undefined; }, id: 'relogio', t: ['O relógio de parede está marcando a hora errada de propósito. O diário diz a hora certa.', 'Ele deve marcar 4 horas e 10 minutos. Escolha “Horas” e clique no 4; depois “Minutos” e clique no 2.'] },
    { quando: function () { return S.folhas.gaveta === undefined; }, id: 'gaveta', t: ['Falta abrir a gaveta da cômoda. Ela está trancada.', 'Com a chave de latão em mãos, clique na gaveta. A folha lá dentro faz uma pergunta sobre a janela.', 'Abra a janela da sala, marque as janelas âmbar da vila e conte. São 9.'] },
    { quando: function () { return concluido() === false; }, id: 'cofre', t: ['Já tenho as quatro folhas! Hora de tentar o cofre, na parede à direita.', 'Digite os dígitos na ordem das folhas: 1, 2, 3, 4.'] }
  ];
  function pedirDica() {
    ultimaAcao = Date.now(); if (concluido()) { falarSimples('Já abri o cofre. Não preciso mais de dicas! A demo está lá embaixo.'); return; }
    var d = DICAS.filter(function (x) { return x.quando(); })[0]; if (!d) return;
    var n = passo.n[d.id] || 0; var t = d.t[Math.min(n, d.t.length - 1)]; passo.n[d.id] = n + 1;
    S.dicas += 1; salvar();
    var b = ui.botoes[d.id === 'chave' ? 'chave' : d.id]; if (b) { b.classList.add('brilha'); setTimeout(function () { b.classList.remove('brilha'); }, 5000); }
    falarSimples(t, 'dica');
  }
  function limparBrilho() { Object.keys(ui.botoes).forEach(function (k) { ui.botoes[k].classList.remove('brilha'); }); }

  /* se ficar parado por um tempo, o objeto da próxima etapa pisca de leve */
  setInterval(function () {
    if (!ui.cena || !S.iniciou || concluido() || painelAtual || Date.now() - ultimaAcao < 40000) return;
    var d = DICAS.filter(function (x) { return x.quando(); })[0]; if (!d) return;
    var b = ui.botoes[d.id]; if (b) { b.classList.add('brilha'); setTimeout(function () { b.classList.remove('brilha'); }, 4000); }
  }, 8000);

  /* ---------------- cliques na sala ---------------- */
  function tremer(b) { b.classList.remove('tremer'); void b.offsetWidth; b.classList.add('tremer'); }
  function clicou(id, b) {
    if (!S.iniciou) { ui.titulo.querySelector('button, a').focus(); return; }
    switch (id) {
      case 'quadro': if (S.folhas.quadro !== undefined) abrirFolha('quadro'); else { abrirQuadro(); } break;
      case 'frascos': if (S.folhas.frascos !== undefined) abrirFolha('frascos'); else abrirFrascos(); break;
      case 'relogio': if (S.folhas.relogio !== undefined) abrirFolha('relogio'); else abrirRelogio(); break;
      case 'livro': abrirLivro(); break;
      case 'janela': abrirJanela(); if (S.folhas.gaveta === undefined && S.gavetaAberta) falarSimples('Preciso contar só as janelas acesas, em âmbar.'); break;
      case 'lampada':
        if (!S.lampada) {
          S.lampada = true; salvar();
          ui.cena.classList.add('puxando'); setTimeout(function () { ui.cena.classList.remove('puxando'); }, 1400);
          pausa(450).then(function () { atualizarCena(); falar(['A lâmpada balança e algo brilhante cai sobre a mesa: uma chave de latão!']); });
        } else falarSimples('A lâmpada ainda balança, devagar. Nada mais aqui em cima.');
        break;
      case 'chave':
        S.chave = true; salvar(); atualizarCena(); falarSimples('Uma chavinha de latão. O diário mencionava uma gaveta… Guardei no bolso.'); break;
      case 'gaveta':
        if (!S.chave) { tremer(b); falarSimples(S.lampada ? 'Trancada. A chave está em cima da mesa, perto do diário.' : 'Está trancada. Deve haver uma chave por aí… talvez em algum lugar alto.'); break; }
        if (!S.gavetaAberta) { S.gavetaAberta = true; salvar(); atualizarCena(); }
        abrirFolha('gaveta'); break;
      case 'cofre':
        if (concluido()) { falarSimples('O cofre já está aberto. A demo está liberada lá embaixo!'); break; }
        if (nFolhas() < 4) { tremer(b); falarSimples('O cofre pede 4 dígitos. Tenho ' + nFolhas() + ' de 4 folhas. Preciso encontrar o resto.'); break; }
        abrirCofre(); break;
      case 'cartaz': case 'gato': case 'planta':
        var novo = !S.extras[id]; S.extras[id] = true; salvar(); atualizarHud(); atualizarCena();
        var ex = Object.keys(S.extras).length;
        falarSimples(TEXTOS.extras[id] + (novo && ex === 3 ? ' ★ Curiosidades 3/3! Nada escapa de mim.' : novo ? ' (★ ' + ex + '/3)' : ''), novo ? 'curiosidade' : '');
        break;
    }
  }

  /* se o servidor recusar o passe, trava de novo */
  document.addEventListener('incognita:travado', function () { if (ui.cena) { atualizarCena(); titulo(); ui.titulo.style.display = ''; } });

  /* ---------------- início ---------------- */
  carregar();
  montar();
  if (concluido()) { S.iniciou = true; }
})();
