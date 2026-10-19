import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { templates } from "../../../packages/shared/src/index.js";
const db = new PrismaClient();
try {
  for (const t of templates)
    await db.resumeTemplate.upsert({
      where: { id: t.id },
      create: { ...t, priceCents: 1990 },
      update: {},
    });
} finally {
  await db.$disconnect();
}
