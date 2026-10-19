import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { fileURLToPath } from "node:url";
import { inject } from "light-my-request";
import { mountFrontend } from "../src/web.js";

test("produção serve o frontend, rotas React e assets sem mascarar erros de API", async () => {
  const app = express();
  mountFrontend(
    app,
    fileURLToPath(new URL("./fixtures/site/", import.meta.url)),
  );
  for (const url of [
    "/",
    "/editor",
    "/editor/resume-id",
    "/checkout/order-id",
    "/painel",
    "/perfil",
    "/modelos",
  ]) {
    const r = await inject(app, { url, headers: { accept: "text/html" } });
    assert.equal(r.statusCode, 200, url);
    assert.match(r.payload, /FORMA_FRONTEND_FIXTURE/);
    assert.equal(r.headers["cache-control"], "no-store");
  }
  const asset = await inject(app, { url: "/assets/app-test.js" });
  assert.equal(asset.statusCode, 200);
  assert.match(String(asset.headers["cache-control"]), /immutable/);
  const api = await inject(app, {
    url: "/api/inexistente",
    headers: { accept: "text/html" },
  });
  assert.equal(api.statusCode, 404);
  assert.match(String(api.headers["content-type"]), /application\/json/);
  assert.ok(!api.payload.includes("FORMA_FRONTEND_FIXTURE"));
  assert.equal(
    (await inject(app, { url: "/assets/ausente.js" })).statusCode,
    404,
  );
  assert.equal((await inject(app, { url: "/.env" })).statusCode, 404);
  assert.throws(
    () => mountFrontend(express(), "pasta-inexistente-para-teste"),
    /Frontend não compilado/,
  );
});

test("SEO usa domínio configurado, sitemap público, noindex privado e 404 real", async () => {
  const app = express();
  mountFrontend(
    app,
    fileURLToPath(new URL("./fixtures/site/", import.meta.url)),
    "https://curriculos.example",
  );
  const get = (url: string) =>
    inject(app, { url, headers: { accept: "text/html" } });
  const home = await get("/?utm_source=teste");
  assert.match(
    home.payload,
    /rel="canonical" href="https:\/\/curriculos.example\/"/,
  );
  assert.match(home.payload, /Criar currículo profissional online/);
  assert.match(home.payload, /application\/ld\+json/);
  assert.equal(home.headers["x-robots-tag"], "index, follow");
  const models = await get("/modelos");
  assert.match(models.payload, /Modelos de currículo profissional/);
  const sitemap = await get("/sitemap.xml");
  assert.match(
    sitemap.payload,
    /<loc>https:\/\/curriculos.example\/modelos<\/loc>/,
  );
  assert.ok(!sitemap.payload.includes("/editor"));
  assert.match(
    (await get("/robots.txt")).payload,
    /Sitemap: https:\/\/curriculos.example\/sitemap.xml/,
  );
  for (const route of [
    "/painel",
    "/editor",
    "/editor/private-id",
    "/checkout/order-id",
    "/perfil",
    "/admin",
  ]) {
    const result = await get(route);
    assert.equal(result.headers["x-robots-tag"], "noindex, nofollow");
    assert.ok(!result.payload.includes('rel="canonical"'));
    assert.ok(!result.payload.includes("application/ld+json"));
  }
  assert.equal((await get("/pagina-inexistente")).statusCode, 404);
  assert.equal((await get("/index.html")).statusCode, 301);
  assert.equal((await get("/.prerender/home.html")).statusCode, 404);
});

test("HTML de produção contém conteúdo público antes de executar JavaScript", async (t) => {
  const { existsSync } = await import("node:fs");
  const directory = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  if (!existsSync(directory + "/.prerender/home.html")) return t.skip("Execute npm run build para validar a pré-renderização");
  const app = express();
  mountFrontend(app, directory, "https://curriculos.example");
  for (const url of ["/", "/modelos"]) {
    const result = await inject(app, { url });
    assert.equal(result.statusCode, 200);
    assert.match(result.payload, /<h1>/);
    assert.match(result.payload, /href="\/editor/);
    assert.match(result.payload, /<div id="root"><header/);
    assert.match(result.payload, /<link rel="canonical"/);
  }
});
