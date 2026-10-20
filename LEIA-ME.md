# Incógnita: site + backend local

## Rodar
1. Instale o Node.js (versão 18 ou mais nova): https://nodejs.org
2. Nesta pasta, rode:
   npm install
3. Copie `.env.example` para `.env` e preencha (veja abaixo).
4. Rode:
   npm start
5. Abra http://localhost:3000  (NÃO abra o arquivo direto nem use o Live Server).

Os e-mails inscritos ficam em `data/subscribers.json`.

## Configurar o envio com Gmail
1. Ative a verificação em 2 etapas na sua conta Google.
2. Acesse https://myaccount.google.com/apppasswords e crie uma "senha de app".
3. No `.env`: SMTP_USER = seu gmail, SMTP_PASS = a senha de 16 letras (sem espaços).
4. Reinicie com `npm start`. Deve aparecer "SMTP ok".

Sem o `.env` preenchido o formulário funciona e salva os e-mails, só não envia a confirmação.

## Importante
- Nunca envie o arquivo `.env` para o GitHub (ele tem sua senha).
- Gmail serve para testar. Para o site real, use um serviço como Resend, Brevo ou SendGrid.
