import fs from "fs";
import path from "path";
import { google } from "googleapis";

type GoogleCredentialsInstalled = {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
};

type GoogleToken = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

const DEFAULT_CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || "./config/google-credentials.json";
const DEFAULT_TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || "./config/google-token.json";

function readJsonFile<T>(filePath: string): T {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Arquivo não encontrado: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

export function getOAuthClient() {
  const credentials = readJsonFile<GoogleCredentialsInstalled>(DEFAULT_CREDENTIALS_PATH);
  const token = readJsonFile<GoogleToken>(DEFAULT_TOKEN_PATH);

  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris?.[0] || "http://localhost"
  );

  oAuth2Client.setCredentials(token);

  // Opcional: Persistir tokens atualizados automaticamente (quando refresh acontecer)
  oAuth2Client.on("tokens", (tokens) => {
    if (!tokens) return;

    const merged: GoogleToken = {
      ...token,
      ...tokens,
      refresh_token: tokens.refresh_token || token.refresh_token, // mantém refresh_token antigo se não vier
    };

    try {
      const abs = path.isAbsolute(DEFAULT_TOKEN_PATH)
        ? DEFAULT_TOKEN_PATH
        : path.resolve(process.cwd(), DEFAULT_TOKEN_PATH);

      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, JSON.stringify(merged, null, 2), "utf-8");
    } catch (err) {
      // Não quebra o runtime caso falhe persistência (ex: FS read-only)
      console.warn("[GoogleAuth] Falha ao persistir token:", err);
    }
  });

  return oAuth2Client;
}
