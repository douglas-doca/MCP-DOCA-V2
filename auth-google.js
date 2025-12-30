import { google } from 'googleapis';
import * as fs from 'fs';
import * as readline from 'readline';

const CREDENTIALS_PATH = './google-credentials.json';
const TOKEN_PATH = './google-token.json';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_id, client_secret, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('\n🔗 Acesse esta URL no navegador:\n');
console.log(authUrl);
console.log('\n📋 Depois de autorizar, cole o código aqui:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Código: ', async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('\n✅ Token salvo em google-token.json!');
  } catch (err) {
    console.error('Erro:', err.message);
  }
  rl.close();
});
