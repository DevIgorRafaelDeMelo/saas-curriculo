import { test } from "node:test";
import assert from "node:assert/strict";
import { readRuntimeConfig } from "../src/config.js";
const production = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://test:test@db.example.test:5432/app",
  RAILWAY_PUBLIC_DOMAIN: "forma.up.railway.app",
  PORT: "8080",
};
test("Railway: domínio, PORT e callbacks derivados sem expor credenciais", () => {
  const c = readRuntimeConfig(production);
  assert.equal(c.appUrl, "https://forma.up.railway.app");
  assert.equal(c.port, 8080);
  assert.equal(c.publicApiUrl, c.appUrl);
  assert.equal(c.googleRedirectUri, c.appUrl + "/api/auth/google/callback");
  assert.equal(c.serveFrontend, true);
  assert.equal(c.googleEnabled, false);
  assert.equal(c.paymentsEnabled, false);
});
test("produção rejeita banco ausente, origem insegura, caminho e porta inválida", () => {
  assert.throws(
    () => readRuntimeConfig({ ...production, DATABASE_URL: "" }),
    /DATABASE_URL/,
  );
  assert.throws(
    () => readRuntimeConfig({ ...production, APP_URL: "http://example.test" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      readRuntimeConfig({
        ...production,
        APP_URL: "https://example.test/editor",
      }),
    /origem/,
  );
  assert.throws(
    () => readRuntimeConfig({ ...production, PORT: "abc" }),
    /PORT/,
  );
  assert.throws(
    () => readRuntimeConfig({ ...production, DATABASE_URL: "sqlite:dev.db" }),
    /PostgreSQL/,
  );
});
test("integrações completas são habilitadas e pares incompletos impedem configuração incorreta", () => {
  const c = readRuntimeConfig({
    ...production,
    GOOGLE_CLIENT_ID: "test-id",
    GOOGLE_CLIENT_SECRET: "test-secret",
    MERCADO_PAGO_ACCESS_TOKEN: "test-token",
    MERCADO_PAGO_WEBHOOK_SECRET: "test-webhook",
  });
  assert.equal(c.googleEnabled, true);
  assert.equal(c.paymentsEnabled, true);
  assert.throws(
    () => readRuntimeConfig({ ...production, GOOGLE_CLIENT_ID: "test-id" }),
    /juntos/,
  );
  assert.throws(
    () =>
      readRuntimeConfig({
        ...production,
        MERCADO_PAGO_ACCESS_TOKEN: "test-token",
      }),
    /juntos/,
  );
  assert.throws(
    () =>
      readRuntimeConfig({
        ...production,
        GOOGLE_CLIENT_ID: "test-id",
        GOOGLE_CLIENT_SECRET: "test-secret",
        GOOGLE_REDIRECT_URI: "https://wrong.example.test/callback",
      }),
    /GOOGLE_REDIRECT_URI/,
  );
});
