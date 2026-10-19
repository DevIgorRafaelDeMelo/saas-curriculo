import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export async function prepareServer({
  validate,
  checkPdf,
  prepareDatabase,
  listen,
}) {
  await validate();
  await checkPdf();
  await prepareDatabase();
  await listen();
}
async function main() {
  const { config } = await import("../apps/api/src/config.ts");
  const { runDatabaseTask } = await import("./database.mjs");
  await prepareServer({
    validate: () => {
      if (!existsSync(new URL("../apps/web/dist/index.html", import.meta.url)))
        throw new Error("Frontend ausente. Execute npm run build.");
    },
    checkPdf: async () => {
      const { generatePdf } = await import("../apps/api/src/pdf.ts");
      const { emptyResume } = await import("../packages/shared/src/index.ts");
      const pdf = await generatePdf(emptyResume());
      if (pdf.subarray(0, 4).toString() !== "%PDF")
        throw new Error("O Chromium não conseguiu gerar PDF.");
      console.log("Chromium pronto para gerar PDFs.");
    },
    prepareDatabase: () => runDatabaseTask("deploy"),
    listen: async () => {
      console.log(
        JSON.stringify({
          event: "startup_prepared",
          google: config.googleEnabled,
          payments: config.paymentsEnabled,
        }),
      );
      await import("../apps/api/src/server.ts");
    },
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error("Inicialização interrompida: " + error.message);
    process.exitCode = 1;
  });
