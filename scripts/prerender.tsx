import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Link } from "react-router-dom";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Home } from "../apps/web/src/pages/Home.js";
import { Gallery } from "../apps/web/src/pages/Gallery.js";
import { Context } from "../apps/web/src/lib.js";
import { Logo } from "../apps/web/src/components.js";

// Render the same public React components for visitors and crawlers. No user data
// or database access at build time; live prices load from the API in the browser.
const target = fileURLToPath(
  new URL("../apps/web/dist/.prerender/", import.meta.url),
);
mkdirSync(target, { recursive: true });
for (const [route, name, Page] of [
  ["/", "home", Home],
  ["/modelos", "modelos", Gallery],
] as const) {
  const html = renderToString(
    <Context.Provider value={{ user: null, catalog: [], notice: () => {} }}>
      <MemoryRouter initialEntries={[route]}>
        <header className="site-header">
          <div className="nav-shell">
            <Logo />
            <nav aria-label="Principal">
              <Link to="/">Início</Link>
              {" · "}
              <Link to="/modelos">Modelos de currículo</Link>
            </nav>
            <Link className="button small" to="/editor">
              Criar currículo
            </Link>
          </div>
        </header>
        <Page />
        <footer className="site-footer">
          <Logo />
          <Link to="/modelos">Modelos</Link>
          <Link to="/privacidade">Privacidade</Link>
        </footer>
      </MemoryRouter>
    </Context.Provider>,
  );
  writeFileSync(`${target}/${name}.html`, html);
}
console.log("Páginas públicas pré-renderizadas: início e modelos.");
