import app, { pool } from "./app";
import { runMigrations } from "./migrations/runMigrations";

const port = Number(process.env.PORT ?? 3000);
const skipStartupMigrations = process.env.SKIP_STARTUP_MIGRATIONS === "1";

async function start() {
  try {
    if (skipStartupMigrations) {
      console.log("Skipping startup migrations for local dev startup.");
    } else {
      console.log("Running migrations...");
      await runMigrations(pool);
    }

    app.listen(port, () => {
      console.log(`Express server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
