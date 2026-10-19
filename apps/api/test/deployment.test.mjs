import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareServer } from "../../../scripts/start.mjs";
test("migração ou Chromium com falha impedem a abertura do servidor", async () => {
  for (const failing of ["checkPdf", "prepareDatabase"]) {
    const called = [];
    const hooks = Object.fromEntries(
      ["validate", "checkPdf", "prepareDatabase", "listen"].map((key) => [
        key,
        async () => {
          called.push(key);
          if (key === failing) throw new Error("fixture-failure");
        },
      ]),
    );
    await assert.rejects(() => prepareServer(hooks), /fixture-failure/);
    assert.ok(!called.includes("listen"));
  }
});
test("servidor só inicia após verificar os arquivos, PDF e banco", async () => {
  const called = [];
  const hooks = Object.fromEntries(
    ["validate", "checkPdf", "prepareDatabase", "listen"].map((key) => [
      key,
      async () => {
        called.push(key);
      },
    ]),
  );
  await prepareServer(hooks);
  assert.deepEqual(called, [
    "validate",
    "checkPdf",
    "prepareDatabase",
    "listen",
  ]);
});
