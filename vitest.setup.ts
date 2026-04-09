import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.test");

dotenv.config({
  path: envPath,
  override: true,
});

const databaseUrl = process.env.DATABASE_URL?.trim();
const pgDatabase = process.env.PGDATABASE?.trim();

if (!databaseUrl && !pgDatabase) {
  throw new Error(
    `DATABASE_URL or PGDATABASE is required for tests (loaded from ${envPath})`,
  );
}

const dbName = databaseUrl ?? pgDatabase ?? "";

if (!dbName.toLowerCase().includes("test")) {
  throw new Error("Refusing to run tests against non-test database");
}