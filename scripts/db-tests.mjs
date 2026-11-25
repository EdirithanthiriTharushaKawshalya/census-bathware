import { spawnSync } from "node:child_process";
// Intentionally local only. Never run the fixture suite against a remote project.
const url = new URL(
  process.env.CENSUS_TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Database tests are restricted to localhost.");
const result = spawnSync(
  "psql",
  ["-v", "ON_ERROR_STOP=1", "-f", "supabase/tests/authorization.sql"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.slice(1),
      PGCONNECT_TIMEOUT: "5",
    },
  },
);
if (result.error)
  console.error(
    "psql is required. Install PostgreSQL client tools and add them to PATH.",
  );
process.exit(result.status ?? 1);
