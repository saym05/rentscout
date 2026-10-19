import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BACKEND_DIR = new URL("../../backend", import.meta.url).pathname;
export const API = "http://localhost:8091";

/** Runs the real FastAPI backend on a fresh SQLite file; restart() keeps the file to prove persistence. */
export class Backend {
  private proc: ChildProcess | null = null;
  readonly dbUrl = `sqlite:///${join(mkdtempSync(join(tmpdir(), "rentscout-e2e-")), "e2e.db")}`;

  constructor(private readonly env: Record<string, string> = {}) {}

  async start() {
    this.proc = spawn("uv", ["run", "uvicorn", "app.main:create_app", "--factory", "--port", "8091"], {
      cwd: BACKEND_DIR, env: { ...process.env, DATABASE_URL: this.dbUrl, ...this.env }, stdio: "ignore",
    });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${API}/api/health`)).ok) return; } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("backend did not start");
  }

  async stop() {
    if (!this.proc) return;
    const p = this.proc;
    this.proc = null;
    await new Promise<void>((resolve) => { p.once("exit", () => resolve()); p.kill("SIGTERM"); });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${API}/api/health`); } catch { return; }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async restart() { await this.stop(); await this.start(); }
}
