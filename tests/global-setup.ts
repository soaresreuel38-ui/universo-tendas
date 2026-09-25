import { execSync } from "node:child_process";

/** Aplica as migrations (inclui as travas CHECK) no banco de testes. Os dados são limpos por teste (tests/helpers.ts). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://ut:ut@localhost:5432/ut_test";
  process.env.TEST_DATABASE_URL = url;
  execSync("npx prisma migrate deploy", {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
