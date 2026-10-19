import { config } from "../apps/api/src/config.ts";
if (
  process.argv.includes("--require-integrations") &&
  (!config.googleEnabled || !config.paymentsEnabled)
) {
  console.error(
    "Configure as credenciais Google e Mercado Pago antes de abrir login e vendas.",
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      appUrl: config.appUrl,
      publicApiUrl: config.publicApiUrl,
      port: config.port,
      googleConfigured: config.googleEnabled,
      paymentsConfigured: config.paymentsEnabled,
    }),
  );
  console.log(
    "Configuração validada. A homologação com os provedores deve ser feita no ambiente de destino.",
  );
}
