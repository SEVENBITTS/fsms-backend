import "dotenv/config";
import { Pool } from "pg";
import { runMigrations } from "../migrations/runMigrations";

async function main() {
  const pool = new Pool();

  try {
    console.log("Running migrations...");
    await runMigrations(pool);
    console.log("Migrations completed");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();