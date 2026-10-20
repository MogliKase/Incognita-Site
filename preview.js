'use strict';
/* Gera "preview-email.html" para você ver o e-mail no navegador SEM enviar nada.
   Uso:  node preview.js   e depois abra o arquivo preview-email.html */
const fs = require('fs');
const path = require('path');
const tpl = require('./email-template');

const pagina = tpl.html({
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  src: (img) => 'public/' + img.arquivo
});
fs.writeFileSync(path.join(__dirname, 'preview-email.html'), pagina);
console.log('Pronto! Abra o arquivo preview-email.html no navegador.');
