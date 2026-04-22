import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const tscCli = path.resolve(root, "node_modules", "typescript", "bin", "tsc");
const runtimeConfig = path.resolve(root, "tsconfig.runtime.json");
const port = Number(process.env.PORT ?? 3000);

const isPortInUse = (targetPort) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port: targetPort,
    });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", (error) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH")
      ) {
        resolve(false);
        return;
      }

      reject(error);
    });
  });

const waitForServerReady = async (targetPort, timeoutMs = 10000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const request = http.get(
        {
          host: "127.0.0.1",
          port: targetPort,
          path: "/",
          timeout: 1000,
        },
        (response) => {
          response.resume();
          resolve(response.statusCode != null && response.statusCode < 500);
        },
      );

      request.on("error", () => resolve(false));
      request.on("timeout", () => {
        request.destroy();
        resolve(false);
      });
    });

    if (ready) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
};

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

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid PORT value: ${process.env.PORT}`);
  process.exit(1);
}

if (await isPortInUse(port)) {
  console.error(
    `Port ${port} is already in use. Stop the existing listener or start with a different PORT before running npm run dev.`,
  );
  process.exit(1);
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

child.on("error", (error) => {
  console.error("Failed to launch dev server:", error);
  process.exit(1);
});

const ready = await waitForServerReady(port);
if (!ready) {
  console.error(
    `Dev server did not become reachable on http://localhost:${port} within 10 seconds.`,
  );
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  process.exit(1);
}

console.log(`Dev server ready on http://localhost:${port}`);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
