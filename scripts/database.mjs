import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
dotenv.config({ path: path.join(projectRoot, ".env") });
function execute(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGTERM", terminate);
    child.once("error", (error) => {
      process.off("SIGTERM", terminate);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      process.off("SIGTERM", terminate);
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Etapa do banco falhou (${signal || code}). O servidor não será iniciado.`,
            ),
          );
    });
  });
}
export async function runDatabaseTask(task) {
  if (task !== "generate" && !process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL não definida. Configure a referência ao PostgreSQL nas variáveis do serviço.",
    );
  const prisma = path.join(projectRoot, "node_modules/prisma/build/index.js");
  const schema = path.join(projectRoot, "apps/api/prisma/schema.prisma");
  if (task === "generate")
    return execute([prisma, "generate", "--schema", schema]);
  if (task === "migrate")
    return execute([prisma, "migrate", "deploy", "--schema", schema]);
  if (task === "seed")
    return execute([
      "--import",
      "tsx",
      path.join(projectRoot, "apps/api/prisma/seed.ts"),
    ]);
  if (task === "deploy") {
    await runDatabaseTask("migrate");
    await runDatabaseTask("seed");
    return;
  }
  throw new Error("Use generate, migrate, seed ou deploy.");
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runDatabaseTask(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
