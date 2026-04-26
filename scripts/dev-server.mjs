import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const tscCli = path.resolve(root, "node_modules", "typescript", "bin", "tsc");
const runtimeConfig = path.resolve(root, "tsconfig.runtime.json");

const compile = spawnSync(
  process.execPath,
  [tscCli, "-p", runtimeConfig],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

const child = spawn(process.execPath, [path.resolve(root, "dist", "server.js")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    SKIP_STARTUP_MIGRATIONS: process.env.SKIP_STARTUP_MIGRATIONS ?? "1",
  },
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
