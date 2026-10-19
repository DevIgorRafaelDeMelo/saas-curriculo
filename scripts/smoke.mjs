const base = new URL(process.argv[2] || "http://localhost:3001");
if (
  !["http:", "https:"].includes(base.protocol) ||
  base.username ||
  base.password
)
  throw new Error("Use uma URL HTTP/HTTPS sem credenciais.");
async function request(path, expected = 200) {
  const r = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (r.status !== expected)
    throw new Error(`${path}: esperado ${expected}, recebido ${r.status}`);
  return r;
}
try {
  const health = await (await request("/api/health")).json();
  if (health.ok !== true) throw new Error("Banco indisponível.");
  const templates = await (await request("/api/templates")).json();
  if (!Array.isArray(templates) || templates.length < 8)
    throw new Error("Seed dos oito modelos ainda não está disponível.");
  const html = await (await request("/")).text();
  const asset = html.match(/src="(\/assets\/[^" ]+\.js)"/);
  if (!asset) throw new Error("Frontend compilado ausente.");
  await request(asset[1]);
  const editor = await (await request("/editor")).text();
  if (!editor.includes('<div id="root"'))
    throw new Error("Fallback das rotas React ausente.");
  await request("/api/me", 401);
  await request("/api/rota-inexistente", 404);
  const features = await (await request("/api/config")).json();
  console.log(
    JSON.stringify({
      ok: true,
      templates: templates.length,
      frontend: true,
      database: true,
      googleConfigured: features.googleEnabled,
      paymentsConfigured: features.paymentsEnabled,
    }),
  );
  console.log(
    "Servidor verificado. Homologue login e pagamento real antes de abrir vendas.",
  );
} catch (error) {
  console.error("Verificação falhou: " + error.message);
  process.exitCode = 1;
}
