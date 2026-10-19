import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
// Explicit opt-in: only a dedicated database whose name ends in _test is accepted.
test(
  "integração PostgreSQL: sessão, isolamento, pedidos, webhook idempotente, estorno e PDF",
  { skip: !process.env.RUN_INTEGRATION },
  async () => {
    assert.match(
      process.env.DATABASE_URL || "",
      /\/_?[^/?]*_test(?:\?|$)/,
      "Use banco dedicado terminado em _test",
    );
    process.env.NODE_ENV = "test";
    const origin = "http://localhost:5173";
    process.env.APP_URL = origin;
    process.env.PUBLIC_API_URL = "https://example.test";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "test-fixture";
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    let state = "approved",
      version = Date.now();
    let orderId = "";
    const provider = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/users/me") return res.end(JSON.stringify({ id: 42 }));
      if (req.url === "/checkout/preferences")
        return res.end(
          JSON.stringify({
            id: "pref",
            init_point: "https://www.mercadopago.com.br/checkout/test",
          }),
        );
      res.end(
        JSON.stringify({
          id: 123,
          external_reference: orderId,
          metadata: { order_id: orderId },
          currency_id: "BRL",
          transaction_amount: 19.9,
          collector_id: 42,
          status: state,
          date_last_updated: new Date(version).toISOString(),
        }),
      );
    });
    await new Promise<void>((r) => provider.listen(0, "127.0.0.1", r));
    process.env.MP_TEST_URL =
      "http://127.0.0.1:" + (provider.address() as any).port;
    const { app, db } = await import("../src/server.js");
    const { hash, token } = await import("../src/security.js");
    const { emptyResume } = await import(
      "../../../packages/shared/src/index.js"
    );
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.on("listening", r));
    const base = "http://127.0.0.1:" + (server.address() as any).port;
    const suffix = token();
    let uid = "";
    let uid2 = "";
    const call = (path: string, options: RequestInit = {}, sid?: string) =>
      fetch(base + "/api" + path, {
        ...options,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(sid ? { Cookie: "sid=" + sid } : {}),
          ...options.headers,
        },
      });
    try {
      const u = await db.user.create({
        data: {
          googleSub: suffix,
          email: suffix + "@example.test",
          name: "Teste",
        },
      });
      uid = u.id;
      const other = await db.user.create({
        data: {
          googleSub: suffix + "2",
          email: suffix + "2@example.test",
          name: "Outro",
        },
      });
      uid2 = other.id;
      const sid = token(),
        sid2 = token();
      await db.session.createMany({
        data: [
          {
            userId: uid,
            tokenHash: hash(sid),
            expiresAt: new Date(Date.now() + 60000),
          },
          {
            userId: uid2,
            tokenHash: hash(sid2),
            expiresAt: new Date(Date.now() + 60000),
          },
        ],
      });
      assert.equal((await call("/me")).status, 401);
      assert.equal((await call("/me", {}, sid)).status, 200);
      const expired = token();
      await db.session.create({
        data: { userId: uid, tokenHash: hash(expired), expiresAt: new Date(0) },
      });
      assert.equal((await call("/me", {}, expired)).status, 401);
      const d = emptyResume();
      d.personal.fullName = "Pessoa Teste";
      d.personal.email = "teste@example.test";
      const created = await call(
        "/resumes",
        { method: "POST", body: JSON.stringify(d) },
        sid,
      );
      assert.equal(created.status, 201);
      const resume: any = await created.json();
      assert.equal((await call("/resumes/" + resume.id, {}, sid2)).status, 404);
      assert.equal(
        (
          await call(
            "/resumes/" + resume.id,
            { method: "PUT", body: JSON.stringify({ revision: 1, data: d }) },
            sid2,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await call(
            "/resumes/" + resume.id,
            { method: "PUT", body: JSON.stringify({ revision: 99, data: d }) },
            sid,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "/resumes",
            {
              method: "POST",
              headers: { Origin: "https://evil.test" },
              body: JSON.stringify(d),
            },
            sid,
          )
        ).status,
        403,
      );
      const requestKey = crypto.randomUUID();
      const body = JSON.stringify({
        resumeId: resume.id,
        requestKey,
        amountCents: 1,
      });
      const purchase = await call("/orders", { method: "POST", body }, sid);
      assert.equal(purchase.status, 201);
      const order: any = await purchase.json();
      orderId = order.id;
      assert.equal(order.amountCents, 1990);
      const repeat: any = await (
        await call("/orders", { method: "POST", body }, sid)
      ).json();
      assert.equal(repeat.id, order.id);
      assert.equal(await db.order.count({ where: { userId: uid } }), 1);
      assert.equal(
        (await call("/orders/" + orderId + "/download", {}, sid)).status,
        403,
      );
      assert.equal((await call("/orders/" + orderId, {}, sid2)).status, 404);
      const ts = String(Math.floor(Date.now() / 1000)),
        rid = "request";
      const sig =
        "ts=" +
        ts +
        ",v1=" +
        createHmac("sha256", "test-secret")
          .update(`id:123;request-id:${rid};ts:${ts};`)
          .digest("hex");
      const notify = () =>
        call("/webhooks/mercadopago?data.id=123", {
          method: "POST",
          headers: { "x-signature": sig, "x-request-id": rid },
          body: JSON.stringify({ type: "payment", data: { id: "123" } }),
        });
      assert.equal(
        (
          await call("/webhooks/mercadopago?data.id=123", {
            method: "POST",
            body: "{}",
          })
        ).status,
        401,
      );
      assert.equal((await notify()).status, 200);
      assert.equal((await notify()).status, 200);
      assert.equal(await db.payment.count({ where: { orderId } }), 1);
      assert.equal(
        await db.downloadEntitlement.count({
          where: { orderId, active: true },
        }),
        1,
      );
      assert.equal(
        (await call("/orders/" + orderId + "/download", {}, sid2)).status,
        403,
      );
      if (process.env.RUN_PDF_TESTS) {
        const download = await call(
          "/orders/" + orderId + "/download",
          {},
          sid,
        );
        assert.equal(download.status, 200);
        assert.equal(
          Buffer.from(await download.arrayBuffer())
            .subarray(0, 4)
            .toString(),
          "%PDF",
        );
      }
      state = "refunded";
      version += 1000;
      assert.equal((await notify()).status, 200);
      assert.equal(
        (await call("/orders/" + orderId + "/download", {}, sid)).status,
        403,
      );
      assert.equal(
        await db.downloadEntitlement.count({
          where: { orderId, active: true },
        }),
        0,
      );
      assert.equal((await call("/admin", {}, sid)).status, 403);
    } finally {
      if (uid) await db.user.delete({ where: { id: uid } });
      if (uid2) await db.user.delete({ where: { id: uid2 } });
      server.close();
      provider.close();
      await db.$disconnect();
    }
  },
);
