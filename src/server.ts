import app, { pool } from "./app";
import { runMigrations } from "./migrations/runMigrations";

const port = Number(process.env.PORT ?? 3000);

async function start() {
  try {
    console.log("Running migrations...");
    await runMigrations(pool);

    app.listen(port, () => {
      console.log(`🚀 Express server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();