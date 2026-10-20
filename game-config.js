'use strict';
/* ============================================================
   MINIGAME: RESPOSTAS (ficam SÓ no servidor, nunca vão para o navegador).
   O código do cofre é formado pelos dígitos das etapas, na ordem das folhas (1, 2, 3, 4).
   Se mudar uma resposta aqui, mude também a pista correspondente em public/js/minigame.js.
   ============================================================ */
module.exports = {
  etapas: {
    /* Folha 1: o jogador limpa a poeira de giz do quadro negro. */
    quadro: { folha: 1, digito: '7', valida: (r) => r === 'limpo' },

    /* Folha 2: frascos na ordem "do mais frio ao mais quente" (diário do técnico). */
    frascos: { folha: 2, digito: '2', valida: (r) => Array.isArray(r) && r.join(',') === 'azul,verde,ambar,vermelho' },

    /* Folha 3: na gaveta trancada. Pergunta: quantas janelas acesas na vila? */
    gaveta: { folha: 3, digito: '9', valida: (r) => Number(r) === 9 },

    /* Folha 4: relógio na hora do apagão (4h10). */
    relogio: { folha: 4, digito: '4', valida: (r) => !!r && Number(r.h) === 4 && Number(r.m) === 10 }
  }
};

/* código final = dígitos ordenados pelo número da folha */
module.exports.codigo = Object.values(module.exports.etapas)
  .sort((a, b) => a.folha - b.folha)
  .map((e) => e.digito)
  .join('');
