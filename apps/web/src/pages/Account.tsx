import React, { useState, useEffect, useRef } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutTemplate,
  ShieldCheck,
  Download,
  Plus,
  Trash2,
  Copy,
  LogOut,
  Menu,
  X,
  Eye,
  CheckCircle2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  LockKeyhole,
  LoaderCircle,
  UserRound,
  Settings2,
} from "lucide-react";
import {
  emptyResume,
  resumeSchema,
  templates,
  type ResumeData,
  type ResumeItem,
} from "../../../../packages/shared/src/index.js";
import { api, money, useApp, colors, statuses } from "../lib";
import { Paper, LoginGate, demo } from "../components";
export function Dashboard() {
  return (
    <LoginGate>
      <DashboardContent />
    </LoginGate>
  );
}
function DashboardContent() {
  const { notice } = useApp();
  const [resumes, setResumes] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = () => {
    setLoading(true);
    Promise.all([api("/resumes"), api("/orders")])
      .then(([r, o]) => {
        setResumes(r);
        setOrders(o);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);
  async function action(id: string, type: string) {
    try {
      if (type === "duplicate")
        await api("/resumes/" + id + "/duplicate", { method: "POST" });
      else {
        if (!confirm("Excluir este currículo?")) return;
        await api("/resumes/" + id, { method: "DELETE" });
      }
      reload();
    } catch (e: any) {
      notice(e.message);
    }
  }
  return (
    <main className="page dashboard">
      <div className="section-head">
        <div>
          <div className="eyebrow">SEU PRÓXIMO CAPÍTULO</div>
          <h1>Meus currículos</h1>
          <p>Suas histórias, todas em um lugar.</p>
        </div>
        <Link className="button" to="/editor">
          <Plus size={18} /> Novo currículo
        </Link>
      </div>
      {loading ? (
        <p>Carregando seus currículos…</p>
      ) : error ? (
        <div className="error-box">
          {error}
          <button onClick={reload}>Tentar novamente</button>
        </div>
      ) : !resumes.length ? (
        <div className="empty-state">
          <FileText size={44} />
          <h2>Sua história começa aqui.</h2>
          <p>
            Crie seu primeiro currículo ou continue o rascunho deste navegador.
          </p>
          <Link className="button" to="/editor">
            Começar agora <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="dashboard-grid">
          {resumes.map((r) => (
            <article className="saved-card" key={r.id}>
              <Link to={"/editor/" + r.id} className="saved-preview">
                <Paper mini data={r.data} />
              </Link>
              <div className="saved-info">
                <h3>{r.name}</h3>
                <p>
                  Atualizado em{" "}
                  {new Date(r.updatedAt).toLocaleDateString("pt-BR")} · v
                  {r.revision}
                </p>
                <div>
                  <Link
                    to={"/editor/" + r.id}
                    className="button secondary small"
                  >
                    Editar e trocar modelo
                  </Link>
                  <button
                    aria-label="Duplicar currículo"
                    className="icon-button"
                    onClick={() => action(r.id, "duplicate")}
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    aria-label="Excluir currículo"
                    className="icon-button"
                    onClick={() => action(r.id, "delete")}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-head purchases-head">
        <div>
          <h2>Compras e downloads</h2>
          <p>Cada compra corresponde a uma versão e um modelo.</p>
        </div>
      </div>
      {orders.length ? (
        <div>
          {orders.map((o) => (
            <div className="order-row" key={o.id}>
              <FileText />
              <div>
                <b>
                  {o.template.name} · versão {o.revision}
                </b>
                <small>
                  {new Date(o.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                  {money(o.amountCents)}
                </small>
              </div>
              <span className={"status " + o.status}>
                {statuses[o.status] || o.status}
              </span>
              <Link className="text-button" to={"/checkout/" + o.id}>
                Ver pedido <ArrowUpRight size={17} />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-text">Seus pedidos aparecerão aqui.</p>
      )}
    </main>
  );
}
export function Checkout() {
  return (
    <LoginGate>
      <CheckoutContent />
    </LoginGate>
  );
}
function CheckoutContent() {
  const { id } = useParams();
  const { notice } = useApp();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const load = () =>
    api("/orders/" + id)
      .then((o) => {
        setOrder(o);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const timer = setInterval(load, 7000);
    return () => clearInterval(timer);
  }, [id]);
  async function refresh() {
    setBusy(true);
    try {
      await api("/orders/" + id + "/reconcile", { method: "POST" });
      await load();
      notice("Status consultado no Mercado Pago.");
    } catch (e: any) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setDownloading(true);
    try {
      const response = await fetch("/api/orders/" + id + "/download", {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "curriculo.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      notice(e.message);
    } finally {
      setDownloading(false);
    }
  }
  if (!order)
    return (
      <main className="page center">
        <p>{error || "Carregando pedido…"}</p>
        <Link to="/painel">Voltar ao painel</Link>
      </main>
    );
  const approved = order.status === "approved" && order.entitlement?.active;
  return (
    <main className="page checkout-page">
      <Link className="back-link" to="/painel">
        <ChevronLeft size={16} /> Voltar ao painel
      </Link>
      <div className="center">
        <div className="eyebrow">O PRÓXIMO PASSO É SEU</div>
        <h1>
          {approved
            ? "Pronto para novas oportunidades."
            : "Seu currículo está quase pronto."}
        </h1>
        <p>
          {approved
            ? "Pagamento confirmado. Seu PDF está disponível."
            : "Você está comprando um arquivo de uma versão e modelo específicos."}
        </p>
      </div>
      <div className="checkout-layout">
        <div className="checkout-preview">
          <Paper data={order.snapshot} watermark={!approved} />
        </div>
        <div className="checkout-summary">
          <h2>Resumo do pedido</h2>
          <dl>
            <div>
              <dt>Modelo</dt>
              <dd>{order.template.name}</dd>
            </div>
            <div>
              <dt>Versão</dt>
              <dd>{order.revision}</dd>
            </div>
            <div>
              <dt>Formato</dt>
              <dd>PDF A4</dd>
            </div>
            <div>
              <dt>Compra</dt>
              <dd>Unitária, sem assinatura</dd>
            </div>
            <div className="total">
              <dt>Total</dt>
              <dd>{money(order.amountCents)}</dd>
            </div>
          </dl>
          <div className={"payment-state " + (approved ? "success" : "")}>
            <ShieldCheck size={22} />
            <div>
              <b>{statuses[order.status] || order.status}</b>
              <p>
                {approved
                  ? "Confirmado com o provedor de pagamento."
                  : "O retorno do checkout não confirma o pagamento. Aguardamos a validação do servidor."}
              </p>
            </div>
          </div>
          {approved ? (
            <button
              className="button"
              onClick={download}
              disabled={downloading}
            >
              {downloading ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Download size={17} />
              )}{" "}
              {downloading ? "Preparando PDF…" : "Baixar meu currículo"}
            </button>
          ) : (
            <>
              {order.checkoutUrl &&
                !["refunded", "charged_back", "cancelled"].includes(
                  order.status,
                ) && (
                  <a className="button" href={order.checkoutUrl}>
                    Pagar com Mercado Pago <ArrowUpRight size={18} />
                  </a>
                )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={refresh}
              >
                {busy ? "Consultando…" : "Verificar pagamento"}
              </button>
            </>
          )}
          <p className="footnote">
            Alterar o currículo ou o modelo exige uma nova compra. Estornos e
            chargebacks revogam o acesso a este arquivo.
          </p>
        </div>
      </div>
    </main>
  );
}
export function Profile() {
  return (
    <LoginGate>
      <ProfileContent />
    </LoginGate>
  );
}
function ProfileContent() {
  const { user, notice } = useApp();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (confirmation !== "EXCLUIR") return;
    setBusy(true);
    try {
      await api("/me", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      });
      localStorage.removeItem("forma-draft");
      location.href = "/";
    } catch (e: any) {
      notice(e.message);
      setBusy(false);
    }
  }
  return (
    <main className="page narrow">
      <div className="eyebrow">SUA CONTA</div>
      <h1>Você no controle.</h1>
      <section className="settings-card">
        <h2>Perfil</h2>
        <label>
          Nome
          <input value={user.name} readOnly />
        </label>
        <label>
          E-mail
          <input value={user.email} readOnly />
        </label>
        <p>
          <ShieldCheck size={16} /> Autenticação pelo Google.
        </p>
        {user.isAdmin && (
          <Link className="button secondary" to="/admin">
            Abrir administração <Settings2 size={17} />
          </Link>
        )}
      </section>
      <section className="settings-card">
        <h2>Seus dados</h2>
        <p>
          Exporte as informações da sua conta, currículos e histórico de
          compras.
        </p>
        <a className="button secondary" href="/api/me/export">
          <Download size={16} /> Exportar meus dados
        </a>
        <Link className="text-button" to="/privacidade">
          Política de privacidade
        </Link>
      </section>
      <section className="settings-card danger">
        <h2>Excluir conta</h2>
        <p>
          A exclusão é permanente e remove currículos, sessões, compras e
          autorizações desta plataforma. Registros de transações podem
          permanecer no Mercado Pago conforme suas obrigações legais.
        </p>
        <label>
          Digite EXCLUIR para confirmar
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button
          className="button danger-button"
          disabled={confirmation !== "EXCLUIR" || busy}
          onClick={remove}
        >
          {busy ? "Excluindo…" : "Excluir minha conta e meus dados"}
        </button>
      </section>
    </main>
  );
}
export function Admin() {
  return (
    <LoginGate>
      <AdminContent />
    </LoginGate>
  );
}
function AdminContent() {
  const { notice, user } = useApp();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const reload = () =>
    api("/admin")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (user?.isAdmin) reload();
  }, [user]);
  if (!user?.isAdmin)
    return (
      <main className="page">
        <h1>Acesso restrito</h1>
      </main>
    );
  async function update(id: string, body: any) {
    try {
      await api("/admin/templates/" + id, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await reload();
      notice("Modelo atualizado.");
    } catch (e: any) {
      notice(e.message);
    }
  }
  return (
    <main className="page">
      <div className="eyebrow">ADMINISTRAÇÃO</div>
      <h1>Visão do negócio.</h1>
      {error && <p className="error-box">{error}</p>}
      {!data ? (
        <p>Carregando…</p>
      ) : (
        <>
          <div className="stats-grid">
            <div>
              <span>Usuários na lista</span>
              <b>{data.users.length}</b>
            </div>
            <div>
              <span>Pedidos na lista</span>
              <b>{data.orders.length}</b>
            </div>
            <div>
              <span>Vendas aprovadas na lista</span>
              <b>
                {money(
                  data.orders
                    .filter((o: any) => o.status === "approved")
                    .reduce((n: number, o: any) => n + o.amountCents, 0),
                )}
              </b>
            </div>
          </div>
          <p className="footnote">
            Listas limitadas a 200 pedidos recentes e até 200 usuários.
          </p>
          <h2>Modelos e preços</h2>
          <div className="admin-templates">
            {data.templates.map((t: any) => (
              <form
                className="admin-template"
                key={t.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fields = new FormData(e.currentTarget);
                  update(t.id, {
                    name: fields.get("name"),
                    priceCents: Math.round(Number(fields.get("price")) * 100),
                    active: fields.get("active") === "on",
                  });
                }}
              >
                <label>
                  Modelo
                  <input name="name" defaultValue={t.name} required />
                </label>
                <label>
                  Preço em reais
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="1"
                    max="1000"
                    defaultValue={t.priceCents / 100}
                    required
                  />
                </label>
                <label className="check-label">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={t.active}
                  />{" "}
                  Ativo
                </label>
                <button className="button secondary small">Salvar</button>
              </form>
            ))}
          </div>
          <h2>Vendas e pagamentos</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Modelo</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Pagamentos</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o: any) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.templateId}</td>
                    <td>{money(o.amountCents)}</td>
                    <td>{statuses[o.status] || o.status}</td>
                    <td>
                      {o.payments
                        .map((p: any) => p.providerId + ": " + p.status)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Usuários</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: any) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
export function Privacy() {
  return (
    <main className="page narrow legal">
      <div className="eyebrow">PRIVACIDADE</div>
      <h1>Sua história é sua.</h1>
      <p>
        Utilizamos os dados fornecidos para criar currículos, autenticar sua
        conta, processar pedidos e permitir downloads autorizados.
      </p>
      <h2>Dados utilizados</h2>
      <p>
        Recebemos nome, e-mail e identificador Google. Armazenamos o conteúdo do
        currículo, modelos e pedidos. Não solicitamos CPF, RG, estado civil ou
        endereço completo.
      </p>
      <h2>Pagamentos e fornecedores</h2>
      <p>
        O pagamento acontece no Mercado Pago. Dados de cartão não são
        armazenados aqui. Google, Mercado Pago e a hospedagem tratam informações
        conforme suas próprias políticas.
      </p>
      <h2>Armazenamento</h2>
      <p>
        Usamos cookies essenciais de sessão e um rascunho no armazenamento local
        deste navegador. Não utilizamos rastreamento publicitário. Em
        dispositivo compartilhado, remova seu rascunho.
      </p>
      <button
        className="button secondary"
        onClick={() => {
          localStorage.removeItem("forma-draft");
          alert("Rascunho local removido.");
        }}
      >
        Remover rascunho deste navegador
      </button>
      <h2>Seus direitos</h2>
      <p>
        No perfil, você pode exportar seus dados e excluir a conta. O provedor
        de pagamento pode conservar registros conforme exigências legais. Os
        dados ficam armazenados enquanto a conta estiver ativa, até solicitação
        de exclusão.
      </p>
      <h2>Responsável pelo serviço</h2>
      <p>
        Antes da abertura ao público, o operador deve informar aqui sua
        identificação, contato de privacidade e canais de atendimento. Esta
        instalação ainda precisa dessa configuração institucional.
      </p>
    </main>
  );
}
