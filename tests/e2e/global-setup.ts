import { type ChildProcess, spawn, spawnSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

// Load .env before anything else so all AWS / Cognito / DB vars are available.
config({ path: resolve(process.cwd(), ".env") });

const DEV_SERVER_URL = "http://localhost:5173";

function deriveDbUrls(databaseUrl: string): { adminUrl: string; testUrl: string } {
  // Replace the DB name at the end of the path: .../dbname → .../postgres and .../app_test
  const adminUrl = databaseUrl.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1");
  const testUrl = databaseUrl.replace(/\/[^/?]+(\?.*)?$/, "/app_test$1");
  return { adminUrl, testUrl };
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(DEV_SERVER_URL, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerRunning()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server at ${DEV_SERVER_URL} did not start within ${timeoutMs}ms`);
}

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set — check your .env file");

  const { adminUrl, testUrl } = deriveDbUrls(process.env.DATABASE_URL);

  // Create a fresh isolated test DB so migrations always run from scratch.
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS app_test");
  await admin.query("CREATE DATABASE app_test");
  await admin.end();

  process.env.DATABASE_URL = testUrl;

  const migrate = spawnSync("npm", ["run", "db:migrate"], {
    env: { ...process.env },
    stdio: "inherit",
    cwd: process.cwd(),
  });
  if (migrate.status !== 0) throw new Error("DB migration failed");

  // Start the dev server after env vars are set. Playwright's webServer plugin runs before
  // globalSetup so we manage the server ourselves here instead.
  let devServer: ChildProcess | null = null;
  const alreadyRunning = await isServerRunning();

  if (!alreadyRunning) {
    devServer = spawn("npm", ["run", "dev"], {
      env: { ...process.env },
      stdio: "pipe",
      cwd: process.cwd(),
    });
    devServer.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
    devServer.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
    await waitForServer(120_000);
  }

  return async () => {
    devServer?.kill("SIGTERM");
  };
}
