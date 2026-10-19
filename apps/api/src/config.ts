import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});
type Environment = Record<string, string | undefined>;
function origin(value: string, label: string, production: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} precisa conter uma URL válida.`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      `${label} deve conter somente a origem, sem caminho, credenciais ou parâmetros.`,
    );
  if (production && url.protocol !== "https:")
    throw new Error(`${label} exige HTTPS em produção.`);
  return url.origin;
}
export function readRuntimeConfig(env: Environment = process.env) {
  const production = env.NODE_ENV === "production";
  const rawOrigin =
    env.APP_URL?.trim() ||
    (env.RAILWAY_PUBLIC_DOMAIN?.trim()
      ? `https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}`
      : "");
  if (production && !rawOrigin)
    throw new Error(
      "Gere o domínio público no Railway ou defina APP_URL com a URL HTTPS do serviço.",
    );
  const appUrl = origin(
    rawOrigin || "http://localhost:5173",
    "APP_URL",
    production,
  );
  const publicApiUrl = origin(
    env.PUBLIC_API_URL?.trim() || appUrl,
    "PUBLIC_API_URL",
    production,
  );
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT deve ser uma porta válida.");
  if (production && !env.DATABASE_URL?.trim())
    throw new Error(
      "Defina DATABASE_URL usando a referência do PostgreSQL no Railway.",
    );
  if (env.DATABASE_URL) {
    try {
      const db = new URL(env.DATABASE_URL);
      if (!["postgres:", "postgresql:"].includes(db.protocol) || !db.hostname)
        throw new Error();
    } catch {
      throw new Error("DATABASE_URL deve ser uma conexão PostgreSQL válida.");
    }
  }
  const googleEnabled = Boolean(
    env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  if (
    Boolean(env.GOOGLE_CLIENT_ID?.trim()) !==
    Boolean(env.GOOGLE_CLIENT_SECRET?.trim())
  )
    throw new Error(
      "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos, ou deixe ambos vazios durante a instalação.",
    );
  const paymentsEnabled = Boolean(
    env.MERCADO_PAGO_ACCESS_TOKEN?.trim() &&
      env.MERCADO_PAGO_WEBHOOK_SECRET?.trim(),
  );
  if (
    Boolean(env.MERCADO_PAGO_ACCESS_TOKEN?.trim()) !==
    Boolean(env.MERCADO_PAGO_WEBHOOK_SECRET?.trim())
  )
    throw new Error(
      "Configure o token e o segredo de webhook do Mercado Pago juntos, ou deixe ambos vazios durante a instalação.",
    );
  if (paymentsEnabled && !publicApiUrl.startsWith("https://"))
    throw new Error(
      "PUBLIC_API_URL exige HTTPS para receber webhooks do Mercado Pago.",
    );
  const expectedCallback = publicApiUrl + "/api/auth/google/callback";
  const googleRedirectUri = env.GOOGLE_REDIRECT_URI?.trim() || expectedCallback;
  if (googleEnabled && production && googleRedirectUri !== expectedCallback)
    throw new Error(
      "GOOGLE_REDIRECT_URI deve ser PUBLIC_API_URL seguido de /api/auth/google/callback.",
    );
  return {
    production,
    appUrl,
    publicApiUrl,
    port,
    googleEnabled,
    paymentsEnabled,
    googleRedirectUri,
    serveFrontend: production || env.SERVE_FRONTEND === "true",
  };
}
export const config = readRuntimeConfig();
