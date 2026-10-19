import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { mountFrontend } from "./web.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  resumeSchema,
  isPayable,
  type ResumeData,
} from "../../../packages/shared/src/index.js";
import {
  token,
  hash,
  verifySignature,
  paymentMatches,
  canDownload,
} from "./security.js";
import { renderResume, generatePdf } from "./pdf.js";
const db = new PrismaClient();
const app = express();
const APP = config.appUrl;
const prod = config.production;
const cookie = {
  httpOnly: true,
  secure: prod,
  sameSite: "lax" as const,
  path: "/",
};
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const wrap =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);
function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
const audit = (action: string, userId?: string, resourceId?: string) =>
  db.auditLog.create({ data: { action, userId, resourceId } });
const admins = () =>
  new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
app.disable("x-powered-by");
app.set("trust proxy", prod ? 1 : false);
app.use(helmet());
app.get("/api/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    googleEnabled: config.googleEnabled,
    paymentsEnabled: config.paymentsEnabled,
  });
});

app.use(cors({ origin: APP, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.path !== "/api/webhooks/mercadopago" &&
    req.get("origin") !== APP
  )
    return res.status(403).json({ error: "Origem não autorizada" });
  next();
});

app.use((req, res, next) => {
  (async () => {
    const raw = req.cookies.sid;
    if (raw) {
      const s = await db.session.findUnique({
        where: { tokenHash: hash(raw) },
        include: { user: true },
      });
      if (s && s.expiresAt > new Date()) res.locals.user = s.user;
    }
  })()
    .then(() => next())
    .catch(next);
});
const auth = (req: Request, res: Response, next: NextFunction) =>
  res.locals.user
    ? next()
    : res
        .status(401)
        .json({ error: "Entre com sua conta Google para continuar" });
const admin = (req: Request, res: Response, next: NextFunction) =>
  res.locals.user && admins().has(res.locals.user.email.toLowerCase())
    ? next()
    : res.status(403).json({ error: "Acesso restrito" });
async function owned(id: string, userId: string) {
  return (
    (await db.resume.findFirst({ where: { id, userId } })) ||
    fail(404, "Currículo não encontrado")
  );
}
async function mp(endpoint: string, options: RequestInit = {}) {
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN)
    fail(503, "Mercado Pago não configurado");
  const response = await fetch(
    (process.env.NODE_ENV === "test" && process.env.MP_TEST_URL
      ? process.env.MP_TEST_URL
      : "https://api.mercadopago.com") + endpoint,
    {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    },
  );
  if (!response.ok) fail(502, "Não foi possível consultar o Mercado Pago");
  return response.json();
}
let collectorId: string | undefined;
async function collector() {
  if (!collectorId) collectorId = String((await mp("/users/me")).id);
  return collectorId;
}
async function reconcile(paymentId: string) {
  const payment = await mp("/v1/payments/" + encodeURIComponent(paymentId));
  const seller = await collector();
  const order = await db.order.findUnique({
    where: { id: String(payment.external_reference || "") },
  });
  if (
    !order ||
    String(payment.id) !== paymentId ||
    !paymentMatches(payment, order, seller)
  )
    fail(400, "Transação incompatível com o pedido");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
    const old = await tx.payment.findUnique({
      where: { providerId: paymentId },
    });
    // Refunded/chargeback payments never regain an entitlement on a stale notification.
    const revoked = ["refunded", "charged_back"].includes(old?.status || "");
    const providerDate = new Date(payment.date_last_updated);
    if (!Number.isFinite(providerDate.getTime()))
      fail(400, "Data da transação inválida");
    if (old && old.providerUpdatedAt >= providerDate) return;
    const status = revoked
      ? old!.status
      : Number(payment.transaction_amount_refunded || 0) > 0
        ? "refunded"
        : String(payment.status);
    await tx.payment.upsert({
      where: { providerId: paymentId },
      create: {
        providerId: paymentId,
        orderId: order.id,
        status,
        amountCents: order.amountCents,
        providerUpdatedAt: providerDate,
      },
      update: { status, providerUpdatedAt: providerDate },
    });
    const payments = await tx.payment.findMany({
      where: { orderId: order.id },
    });
    const chargeback = payments.some((p) => p.status === "charged_back");
    const approved =
      !chargeback && payments.some((p) => p.status === "approved");
    const orderStatus = approved
      ? "approved"
      : chargeback
        ? "charged_back"
        : status;
    await tx.order.update({
      where: { id: order.id },
      data: { status: orderStatus },
    });
    await tx.downloadEntitlement.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, active: approved },
      update: { active: approved },
    });
    await tx.auditLog.create({
      data: {
        action: "payment." + status,
        resourceId: order.id,
        userId: order.userId,
      },
    });
  });
}
app.get(
  "/api/health",
  wrap(async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  }),
);
app.get("/api/auth/google", (req, res) => {
  if (!config.googleEnabled)
    return res.status(503).send("Configure o Google OAuth no servidor.");
  const state = token(),
    nonce = token(),
    verifier = token();
  res.cookie("oauth", JSON.stringify({ state, nonce, verifier }), {
    ...cookie,
    maxAge: 600000,
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params);
});
app.get(
  "/api/auth/google/callback",
  wrap(async (req, res) => {
    let saved: any;
    try {
      saved = JSON.parse(req.cookies.oauth || "{}");
    } catch {
      fail(400, "Sessão OAuth inválida");
    }
    res.clearCookie("oauth", cookie);
    if (
      !saved.state ||
      req.query.state !== saved.state ||
      typeof req.query.code !== "string"
    )
      fail(400, "Autenticação inválida ou expirada");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({
        code: req.query.code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
    });
    if (!response.ok) fail(401, "Falha no login Google");
    const result: any = await response.json();
    const { payload } = await jwtVerify(result.id_token, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    if (
      payload.nonce !== saved.nonce ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    )
      fail(401, "Identidade Google não validada");
    const user = await db.user.upsert({
      where: { googleSub: payload.sub },
      create: {
        googleSub: payload.sub,
        email: String(payload.email),
        name: String(payload.name || payload.email),
      },
      update: {
        email: String(payload.email),
        name: String(payload.name || payload.email),
      },
    });
    if (req.cookies.sid)
      await db.session.deleteMany({
        where: { tokenHash: hash(req.cookies.sid) },
      });
    const sid = token();
    const maxAge = 7 * 86400000;
    await db.session.create({
      data: {
        tokenHash: hash(sid),
        userId: user.id,
        expiresAt: new Date(Date.now() + maxAge),
      },
    });
    res.cookie("sid", sid, { ...cookie, maxAge });
    await audit("auth.login", user.id);
    res.redirect(APP + "/painel");
  }),
);
app.get("/api/me", auth, (req, res) =>
  res.json({
    ...res.locals.user,
    isAdmin: admins().has(res.locals.user.email.toLowerCase()),
  }),
);
app.post(
  "/api/auth/logout",
  auth,
  wrap(async (req, res) => {
    await db.session.deleteMany({
      where: { tokenHash: hash(req.cookies.sid) },
    });
    res.clearCookie("sid", cookie);
    res.sendStatus(204);
  }),
);
app.get(
  "/api/templates",
  wrap(async (_req, res) =>
    res.json(
      await db.resumeTemplate.findMany({
        where: { active: true },
        orderBy: { id: "asc" },
      }),
    ),
  ),
);
app.post(
  "/api/preview",
  rateLimit({ windowMs: 60000, limit: 40 }),
  wrap(async (req, res) => {
    const data = resumeSchema.parse(req.body);
    res.type("html").send(renderResume(data, true));
  }),
);
app.get(
  "/api/resumes",
  auth,
  wrap(async (_req, res) =>
    res.json(
      await db.resume.findMany({
        where: { userId: res.locals.user.id },
        orderBy: { updatedAt: "desc" },
      }),
    ),
  ),
);
app.post(
  "/api/resumes",
  auth,
  wrap(async (req, res) => {
    const data = resumeSchema.parse(req.body);
    if (
      !(await db.resumeTemplate.findFirst({
        where: { id: data.templateId, active: true },
      }))
    )
      fail(400, "Modelo indisponível");
    const r = await db.resume.create({
      data: {
        userId: res.locals.user.id,
        name: data.name,
        templateId: data.templateId,
        data,
        sections: {
          create: data.sections.map((s, position) => ({
            kind: s.kind,
            position,
            visible: s.visible,
            data: s,
          })),
        },
      },
    });
    res.status(201).json(r);
  }),
);
app.get(
  "/api/resumes/:id",
  auth,
  wrap(async (req, res) =>
    res.json(await owned(req.params.id, res.locals.user.id)),
  ),
);
app.put(
  "/api/resumes/:id",
  auth,
  wrap(async (req, res) => {
    const input = z
      .object({ revision: z.number().int().positive(), data: resumeSchema })
      .parse(req.body);
    const r = await owned(req.params.id, res.locals.user.id);
    if (
      !(await db.resumeTemplate.findFirst({
        where: { id: input.data.templateId, active: true },
      }))
    )
      fail(400, "Modelo indisponível");
    const updated = await db.$transaction(async (tx) => {
      const update = await tx.resume.updateMany({
        where: {
          id: r.id,
          userId: res.locals.user.id,
          revision: input.revision,
        },
        data: {
          name: input.data.name,
          templateId: input.data.templateId,
          data: input.data,
          revision: { increment: 1 },
        },
      });
      if (!update.count)
        fail(
          409,
          "Este currículo mudou em outra aba. Recarregue antes de salvar.",
        );
      await tx.resumeSection.deleteMany({ where: { resumeId: r.id } });
      if (input.data.sections.length)
        await tx.resumeSection.createMany({
          data: input.data.sections.map((s, position) => ({
            resumeId: r.id,
            kind: s.kind,
            position,
            visible: s.visible,
            data: s,
          })),
        });
      return tx.resume.findUnique({ where: { id: r.id } });
    });
    res.json(updated);
  }),
);
app.post(
  "/api/resumes/:id/duplicate",
  auth,
  wrap(async (req, res) => {
    const r = await owned(req.params.id, res.locals.user.id);
    const d = resumeSchema.parse(r.data);
    d.name += " (cópia)";
    res.status(201).json(
      await db.resume.create({
        data: {
          userId: res.locals.user.id,
          name: d.name,
          templateId: d.templateId,
          data: d,
          sections: {
            create: d.sections.map((s, position) => ({
              kind: s.kind,
              position,
              visible: s.visible,
              data: s,
            })),
          },
        },
      }),
    );
  }),
);
app.delete(
  "/api/resumes/:id",
  auth,
  wrap(async (req, res) => {
    await owned(req.params.id, res.locals.user.id);
    if (await db.order.count({ where: { resumeId: req.params.id } }))
      fail(
        409,
        "Currículo com histórico de compras. Exclua a conta para remover todos os dados.",
      );
    await db.resume.delete({ where: { id: req.params.id } });
    res.sendStatus(204);
  }),
);
app.post(
  "/api/orders",
  auth,
  rateLimit({ windowMs: 60000, limit: 10 }),
  wrap(async (req, res) => {
    const input = z
      .object({ resumeId: z.string(), requestKey: z.string().uuid() })
      .parse(req.body);
    if (!config.paymentsEnabled)
      fail(503, "Configure a URL pública HTTPS e o segredo de webhook");
    const resume = await owned(input.resumeId, res.locals.user.id);
    const data = resumeSchema.parse(resume.data);
    if (!isPayable(data)) fail(400, "Preencha nome e e-mail antes de comprar");
    const template = await db.resumeTemplate.findFirst({
      where: { id: resume.templateId, active: true },
    });
    if (!template) fail(400, "Modelo indisponível");
    const order = await db.order.upsert({
      where: {
        userId_requestKey: {
          userId: res.locals.user.id,
          requestKey: input.requestKey,
        },
      },
      create: {
        userId: res.locals.user.id,
        resumeId: resume.id,
        templateId: template.id,
        revision: resume.revision,
        snapshot: data,
        amountCents: template.priceCents,
        requestKey: input.requestKey,
      },
      update: {},
    });
    if (order.resumeId !== resume.id) fail(409, "Chave de pedido já utilizada");
    if (order.checkoutUrl) return res.json(order);
    const preference = await mp("/checkout/preferences", {
      method: "POST",
      headers: { "X-Idempotency-Key": order.id },
      body: JSON.stringify({
        items: [
          {
            id: order.id,
            title: `Currículo ${template.name} · versão ${order.revision}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: order.amountCents / 100,
          },
        ],
        external_reference: order.id,
        metadata: { order_id: order.id },
        notification_url: config.publicApiUrl + "/api/webhooks/mercadopago",
        back_urls: {
          success: APP + "/checkout/" + order.id,
          pending: APP + "/checkout/" + order.id,
          failure: APP + "/checkout/" + order.id,
        },
        ...(APP.startsWith("https://") ? { auto_return: "approved" } : {}),
      }),
    });
    const checkout = new URL(preference.init_point);
    if (
      checkout.protocol !== "https:" ||
      !/(^|\.)mercadopago\.(com|com\.br)$/.test(checkout.hostname)
    )
      fail(502, "Checkout inválido");
    res.status(201).json(
      await db.order.update({
        where: { id: order.id },
        data: {
          preferenceId: String(preference.id),
          checkoutUrl: checkout.href,
          status: "pending",
        },
      }),
    );
  }),
);
app.get(
  "/api/orders",
  auth,
  wrap(async (_req, res) =>
    res.json(
      await db.order.findMany({
        where: { userId: res.locals.user.id },
        include: { entitlement: true, template: true, payments: true },
        orderBy: { createdAt: "desc" },
      }),
    ),
  ),
);
app.get(
  "/api/orders/:id",
  auth,
  wrap(async (req, res) => {
    const o = await db.order.findFirst({
      where: { id: req.params.id, userId: res.locals.user.id },
      include: { entitlement: true, template: true, payments: true },
    });
    if (!o) fail(404, "Pedido não encontrado");
    res.json(o);
  }),
);
app.post(
  "/api/orders/:id/reconcile",
  auth,
  rateLimit({ windowMs: 60000, limit: 5 }),
  wrap(async (req, res) => {
    const o = await db.order.findFirst({
      where: { id: req.params.id, userId: res.locals.user.id },
    });
    if (!o) fail(404, "Pedido não encontrado");
    const result = await mp(
      "/v1/payments/search?external_reference=" + encodeURIComponent(o.id),
    );
    for (const payment of result.results || [])
      await reconcile(String(payment.id));
    res.json({ ok: true });
  }),
);
app.post(
  "/api/webhooks/mercadopago",
  wrap(async (req, res) => {
    const id =
      typeof req.query["data.id"] === "string" ? req.query["data.id"] : "";
    if (
      !verifySignature(
        req.get("x-signature") || "",
        req.get("x-request-id") || "",
        id,
        process.env.MERCADO_PAGO_WEBHOOK_SECRET || "",
      )
    )
      fail(401, "Assinatura inválida");
    if (req.body.type !== "payment") return res.sendStatus(200);
    if (String(req.body.data?.id) !== id)
      fail(400, "Identificador inconsistente");
    await reconcile(id);
    res.sendStatus(200);
  }),
);
app.get(
  "/api/orders/:id/download",
  auth,
  rateLimit({ windowMs: 60000, limit: 5 }),
  wrap(async (req, res) => {
    const order = await db.order.findFirst({
      where: { id: req.params.id, userId: res.locals.user.id },
      include: { entitlement: true, payments: true },
    });
    if (!canDownload(order, res.locals.user.id))
      fail(403, "Download não autorizado");
    // Revalidate with the provider to catch a refund even if its webhook was missed.
    for (const payment of order!.payments.filter(
      (p) => p.status === "approved",
    ))
      await reconcile(payment.providerId);
    const current = await db.order.findUnique({
      where: { id: order!.id },
      include: { entitlement: true },
    });
    if (!canDownload(current, res.locals.user.id))
      fail(403, "Pagamento estornado ou não aprovado");
    const pdf = await generatePdf(resumeSchema.parse(order!.snapshot));
    await audit("resume.download", res.locals.user.id, order!.id);
    res.type("pdf").attachment("curriculo.pdf").send(pdf);
  }),
);
app.get(
  "/api/me/export",
  auth,
  wrap(async (_req, res) => {
    const userId = res.locals.user.id;
    res.attachment("meus-dados.json").json({
      user: res.locals.user,
      resumes: await db.resume.findMany({
        where: { userId },
        include: { sections: true },
      }),
      orders: await db.order.findMany({
        where: { userId },
        include: { payments: true, entitlement: true },
      }),
      audit: await db.auditLog.findMany({ where: { userId } }),
    });
  }),
);
app.delete(
  "/api/me",
  auth,
  wrap(async (req, res) => {
    z.object({ confirmation: z.literal("EXCLUIR") }).parse(req.body);
    await db.$transaction([
      db.auditLog.deleteMany({ where: { userId: res.locals.user.id } }),
      db.user.delete({ where: { id: res.locals.user.id } }),
    ]);
    res.clearCookie("sid", cookie);
    res.sendStatus(204);
  }),
);
app.get(
  "/api/admin",
  auth,
  admin,
  wrap(async (_req, res) => {
    const [templates, orders, users] = await Promise.all([
      db.resumeTemplate.findMany(),
      db.order.findMany({
        include: { payments: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.user.findMany({
        select: { id: true, name: true, email: true, createdAt: true },
        take: 200,
      }),
    ]);
    res.json({ templates, orders, users });
  }),
);
app.patch(
  "/api/admin/templates/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(1).max(100).optional(),
        priceCents: z.number().int().min(100).max(100000).optional(),
        active: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const t = await db.resumeTemplate.update({
      where: { id: req.params.id },
      data,
    });
    await audit("template.update", res.locals.user.id, t.id);
    res.json(t);
  }),
);
mountFrontend(
  app,
  config.serveFrontend
    ? fileURLToPath(new URL("../../web/dist/", import.meta.url))
    : undefined,
  config.appUrl,
);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof z.ZodError ? 400 : err.status || 500;
  if (status >= 500)
    console.error({ event: "request_failed", code: err.code || "INTERNAL" });
  res.status(status).json({
    error:
      status >= 500
        ? "Serviço temporariamente indisponível. Verifique a configuração e tente novamente."
        : err.message,
    issues: err instanceof z.ZodError ? err.flatten() : undefined,
  });
});
export { app, db };
const server =
  process.env.NODE_ENV === "test"
    ? null
    : app.listen(config.port, "0.0.0.0", () =>
        console.log("Servidor disponível na porta " + config.port),
      );
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
  clearTimeout(timeout);
}
process.once("SIGTERM", () => {
  void shutdown();
});
process.once("SIGINT", () => {
  void shutdown();
});
