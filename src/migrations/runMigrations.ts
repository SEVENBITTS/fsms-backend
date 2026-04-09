import fs from "fs/promises";
import path from "path";
import { Pool } from "pg";

export async function runMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "src/migrations");

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, "utf8");

    try {
      await pool.query(sql);
    } catch (error) {
      console.error(`Migration failed: ${file}`);
      throw error;
    }
  }
}