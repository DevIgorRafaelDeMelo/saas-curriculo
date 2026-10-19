import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { api, Context, useApp } from "./lib";
import { Logo } from "./components";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { Editor } from "./pages/Editor";
import { Dashboard, Checkout, Profile, Admin, Privacy } from "./pages/Account";
import "./styles.css";
import { Seo } from "./Seo";
function App() {
  const [user, setUser] = useState<any>(undefined);
  const [notice, setNotice] = useState("");
  const [catalog, setCatalog] = useState<any[]>([]);
  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => setUser(null));
    api("/templates")
      .then(setCatalog)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  return (
    <Context.Provider value={{ user, setUser, notice: setNotice, catalog }}>
      <BrowserRouter>
        <Seo />
        <Header />
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button aria-label="Fechar mensagem" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/editor/:id?" element={<Editor />} />
          <Route path="/modelos" element={<Gallery />} />
          <Route path="/painel" element={<Dashboard />} />
          <Route path="/checkout/:id" element={<Checkout />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route
            path="*"
            element={
              <main className="page">
                <h1>Página não encontrada</h1>
                <Link to="/">Voltar ao início</Link>
              </main>
            }
          />
        </Routes>
        <Footer />
      </BrowserRouter>
    </Context.Provider>
  );
}
function Header() {
  const { user, setUser, notice } = useApp();
  const [open, setOpen] = useState(false);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      location.href = "/";
    } catch (e: any) {
      notice(e.message);
    }
  }
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Logo />
        <nav
          className={open ? "nav-links open" : "nav-links"}
          aria-label="Principal"
        >
          <Link onClick={() => setOpen(false)} to="/modelos">
            Modelos de currículo
          </Link>
          <a href="/#como-funciona" onClick={() => setOpen(false)}>
            Como funciona
          </a>
          <a href="/#precos" onClick={() => setOpen(false)}>
            Preços
          </a>
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <Link className="login-link" to="/painel">
                Meu painel
              </Link>
              <Link className="avatar" aria-label="Meu perfil" to="/perfil">
                {user.name.slice(0, 1)}
              </Link>
              <button
                className="icon-button"
                aria-label="Sair"
                onClick={logout}
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <a className="login-link" href="/api/auth/google">
              <span className="google-g">G</span> Entrar com Google
            </a>
          )}
          <Link className="button small" to="/editor">
            Criar currículo <ArrowUpRight size={16} />
          </Link>
          <button
            className="mobile-menu icon-button"
            onClick={() => setOpen(!open)}
            aria-label="Abrir navegação"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Logo />
        <p>Uma boa forma de começar.</p>
      </div>
      <div>
        <Link to="/modelos">Modelos</Link>
        <Link to="/privacidade">Privacidade</Link>
        <Link to="/perfil">Sua conta</Link>
        <span>© {new Date().getFullYear()} Forma</span>
      </div>
    </footer>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
