import express, { type Express } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pageSeo, publicPages } from "../../../packages/shared/src/seo.js";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function mountFrontend(
  app: Express,
  directory?: string,
  origin = "http://localhost:5173",
) {
  // Unknown API routes must never return the SPA document with status 200.
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Rota da API não encontrada" }),
  );
  if (!directory) return;
  const root = path.resolve(directory);
  const index = path.join(root, "index.html");
  if (!existsSync(index))
    throw new Error(
      "Frontend não compilado. Execute npm run build antes de iniciar o servidor.",
    );
  const base = new URL(origin).origin;
  const shell = readFileSync(index, "utf8");
  const documents = new Map<string, string>();
  for (const [route, name] of [
    ["/", "home"],
    ["/modelos", "modelos"],
  ]) {
    const file = path.join(root, ".prerender", name + ".html");
    if (existsSync(file)) documents.set(route, readFileSync(file, "utf8"));
  }
  app.get("/robots.txt", (_req, res) => {
    res
      .type("text/plain")
      .send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", (_req, res) => {
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(
        publicPages,
      )
        .map((route) => `<url><loc>${escape(base + route)}</loc></url>`)
        .join("")}</urlset>`,
    );
  });
  // Keep the unprocessed SPA shell out of search results and avoid duplicates.
  app.get("/index.html", (_req, res) => res.redirect(301, "/"));
  app.use(
    express.static(root, {
      index: false,
      redirect: false,
      dotfiles: "deny",
      setHeaders(res, file) {
        res.setHeader(
          "Cache-Control",
          file.startsWith(path.join(root, "assets") + path.sep)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );
  app.get("*", (req, res) => {
    if (
      path.extname(req.path) ||
      req.path.split("/").some((segment) => segment.startsWith(".")) ||
      !req.accepts("html")
    )
      return res.status(404).type("text").send("Arquivo não encontrado");
    res.setHeader("Cache-Control", "no-store");
    const known =
      req.path in publicPages ||
      ["/privacidade", "/painel", "/perfil", "/admin", "/editor"].includes(
        req.path,
      ) ||
      /^\/(editor|checkout)\/[^/]+$/.test(req.path);
    const seo = pageSeo(req.path);
    res.setHeader(
      "X-Robots-Tag",
      seo.index ? "index, follow" : "noindex, nofollow",
    );
    const url = escape(base + req.path);
    const structured = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Forma",
      url: base + "/",
      inLanguage: "pt-BR",
    }).replace(/</g, "\\u003c");
    const head = `<title>${escape(seo.title)}</title><meta name="description" content="${escape(seo.description)}"><meta name="robots" content="${seo.index ? "index, follow" : "noindex, nofollow"}"><meta name="forma-origin" content="${escape(base)}"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Forma"><meta property="og:title" content="${escape(seo.title)}"><meta property="og:description" content="${escape(seo.description)}"><meta property="og:url" content="${url}">${seo.index ? `<link rel="canonical" href="${url}"><script id="forma-structured-data" type="application/ld+json">${structured}</script>` : ""}`;
    const googleVerification =
      req.path === "/"
        ? '<meta name="google-site-verification" content="aKVMa03vQpuckoY6qEmWEUjl1qSbk4NiWsiCkA8QlP8" />'
        : "";
    let html = shell
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name=["']description["'][^>]*>/i, "")
      .replace("</head>", googleVerification + head + "</head>");
    const content = documents.get(req.path);
    if (content)
      html = html.replace(
        /<div id="root"><\/div>/,
        () => `<div id="root">${content}</div>`,
      );
    res
      .status(known ? 200 : 404)
      .type("html")
      .send(html);
  });
}
