import { test } from "node:test";
import assert from "node:assert/strict";
import { inject } from "light-my-request";
import { emptyResume } from "../../../packages/shared/src/index.js";
import { hash } from "../src/security.js";

test("API sem sockets: sessão, isolamento, origem, login e prévia", async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_URL = "http://localhost:5173";
  process.env.ADMIN_EMAILS = "";
  const { app, db } = await import("../src/server.js");
  const origin = "http://localhost:5173";
  const request = (
    url: string,
    method: any = "GET",
    payload?: unknown,
    cookie?: string,
    requestOrigin = origin,
  ) =>
    inject(app, {
      url,
      method,
      headers: {
        origin: requestOrigin,
        ...(cookie ? { cookie: "sid=" + cookie } : {}),
      },
      ...(payload
        ? {
            payload: JSON.stringify(payload),
            headers: {
              origin: requestOrigin,
              "content-type": "application/json",
              ...(cookie ? { cookie: "sid=" + cookie } : {}),
            },
          }
        : {}),
    });
  const originalSession = db.session.findUnique;
  const originalResume = db.resume.findFirst;
  try {
    for (const path of [
      "/me",
      "/resumes",
      "/orders",
      "/orders/other/download",
      "/admin",
    ])
      assert.equal((await request("/api" + path)).statusCode, 401);
    assert.equal(
      (
        await request(
          "/api/resumes",
          "POST",
          {},
          undefined,
          "https://evil.example",
        )
      ).statusCode,
      403,
    );
    const draft = emptyResume();
    draft.personal.fullName = "<script>alert(1)</script>";
    const preview = await request("/api/preview", "POST", draft);
    assert.equal(preview.statusCode, 200);
    assert.ok(preview.payload.includes("&lt;script&gt;"));
    assert.ok(preview.payload.includes("PRÉVIA GRATUITA"));
    draft.personal.linkedin = "javascript:alert(1)";
    assert.equal(
      (await request("/api/preview", "POST", draft)).statusCode,
      400,
    );
    (db.session.findUnique as any) = async ({ where }: any) => ({
      user: { id: "owner-a", email: "a@example.test", name: "Pessoa A" },
      expiresAt: new Date(
        where.tokenHash === hash("expired") ? 0 : Date.now() + 60000,
      ),
    });
    (db.resume.findFirst as any) = async ({ where }: any) => {
      assert.equal(
        where.userId,
        "owner-a",
        "Consulta deve filtrar pelo usuário autenticado",
      );
      assert.equal(where.id, "resume-b");
      return null;
    };
    assert.equal(
      (await request("/api/me", "GET", undefined, "expired")).statusCode,
      401,
    );
    assert.equal(
      (await request("/api/me", "GET", undefined, "valid")).statusCode,
      200,
    );
    assert.equal(
      (await request("/api/resumes/resume-b", "GET", undefined, "valid"))
        .statusCode,
      404,
    );
    assert.equal(
      (await request("/api/resumes/resume-b", "DELETE", undefined, "valid"))
        .statusCode,
      404,
    );
    assert.equal(
      (await request("/api/admin", "GET", undefined, "valid")).statusCode,
      403,
    );
  } finally {
    db.session.findUnique = originalSession;
    db.resume.findFirst = originalResume;
    await db.$disconnect();
  }
});
