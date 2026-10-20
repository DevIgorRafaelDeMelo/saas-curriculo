import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifySignature,
  paymentMatches,
  canDownload,
  escapeHtml,
  token,
  hash,
} from "../src/security.js";
import { renderResume, generatePdf } from "../src/pdf.js";
import {
  emptyResume,
  resumeSchema,
  templates,
} from "../../../packages/shared/src/index.js";
const now = Date.now(),
  ts = String(Math.floor(now / 1000)),
  secret = "test-secret-only",
  id = "123",
  requestId = "request";
const signature =
  "ts=" +
  ts +
  ",v1=" +
  createHmac("sha256", secret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest("hex");
test("webhook aceita assinatura válida e rejeita alterações, segredo ausente e replay expirado", () => {
  assert.equal(verifySignature(signature, requestId, id, secret, now), true);
  assert.equal(
    verifySignature(signature, requestId, "999", secret, now),
    false,
  );
  assert.equal(verifySignature(signature, requestId, id, "", now), false);
  assert.equal(
    verifySignature(signature, requestId, id, secret, now + 600000),
    false,
  );
  assert.equal(verifySignature("ts=bad,v1=bad", requestId, id, secret), false);
});
test("pagamento confere pedido, valor, moeda, vendedor e metadata", () => {
  const order = { id: "o1", currency: "BRL", amountCents: 1990 };
  const p = {
    external_reference: "o1",
    currency_id: "BRL",
    transaction_amount: 19.9,
    collector_id: 42,
    metadata: { order_id: "o1" },
  };
  assert.ok(paymentMatches(p, order, "42"));
  for (const delta of [
    { transaction_amount: 1 },
    { currency_id: "USD" },
    { external_reference: "other" },
    { collector_id: 9 },
    { metadata: { order_id: "other" } },
  ])
    assert.equal(paymentMatches({ ...p, ...delta }, order, "42"), false);
});
test("download exige proprietário, aprovação e entitlement ativo", () => {
  const o = { userId: "u", status: "approved", entitlement: { active: true } };
  assert.ok(canDownload(o, "u"));
  assert.equal(canDownload(o, "other"), false);
  for (const status of ["pending", "rejected", "refunded", "charged_back"])
    assert.equal(canDownload({ ...o, status }, "u"), false);
  assert.equal(
    canDownload({ ...o, entitlement: { active: false } }, "u"),
    false,
  );
  assert.equal(canDownload(null, "u"), false);
});
test("tokens de sessão são aleatórios e persistidos como hash", () => {
  const a = token(),
    b = token();
  assert.notEqual(a, b);
  assert.equal(hash(a).length, 64);
  assert.notEqual(hash(a), a);
});
test("validação bloqueia URLs executáveis e imagem externa", () => {
  const d = emptyResume();
  d.personal.linkedin = "javascript:alert(1)";
  assert.equal(resumeSchema.safeParse(d).success, false);
  d.personal.linkedin = "";
  d.personal.photo = "https://example.com/photo.png";
  assert.equal(resumeSchema.safeParse(d).success, false);
});
test("dezoito modelos renderizam HTML escapado e marca d'água só na prévia", () => {
  assert.equal(templates.length, 18);
  for (const t of templates) {
    const d = emptyResume();
    d.templateId = t.id;
    d.personal.fullName = "<script>alert(1)</script>";
    const html = renderResume(d, true);
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("PRÉVIA GRATUITA"));
    assert.ok(html.includes('class="' + t.style + '"'));
    assert.ok(!renderResume(d).includes("PRÉVIA GRATUITA"));
  }
  assert.equal(escapeHtml('"<>&'), "&quot;&lt;&gt;&amp;");
});
test(
  "PDF real começa com assinatura PDF e tem conteúdo",
  { skip: !process.env.RUN_PDF_TESTS },
  async () => {
    const d = emptyResume();
    d.personal.fullName = "Teste de currículo";
    const pdf = await generatePdf(d);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 1000);
  },
);
