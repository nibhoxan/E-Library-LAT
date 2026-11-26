import "dotenv/config";
import { prisma } from "./data/prisma.js";
import { seedDatabase } from "./data/seed.js";
import { ensureSchema } from "./data/schema.js";
import { validateJwtSecret } from "./http/auth.js";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4100);

async function prepareDatabase() {
  await ensureSchema();
  await prisma.$connect();
  await seedDatabase();
  console.info(`Reading Room API is ready with ${await prisma.title.count()} titles.`);
}

async function start() {
  validateJwtSecret();
  await prepareDatabase();
  const server = app.listen(port, "0.0.0.0", () => {
    console.info(`Reading Room API listening on port ${port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
      });
    });
  }
}

void start().catch((error: unknown) => {
  console.error("API startup failed before listening:", error);
  process.exitCode = 1;
});
