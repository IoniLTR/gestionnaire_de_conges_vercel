// lib/db.ts
import mysql, { Pool, PoolConnection } from "mysql2/promise";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const host = process.env.DB_HOST ?? "";
  const port = Number(process.env.DB_PORT ?? 4000);
  const user = process.env.DB_USER ?? "";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "";

  const forceSSL =
    String(process.env.DB_SSL || "").toLowerCase() === "true" ||
    host.includes("tidbcloud.com");

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ...(forceSSL
      ? {
          ssl: {
            // TiDB Serverless exige TLS
            rejectUnauthorized: true,
            minVersion: "TLSv1.2",
          },
        }
      : {}),
  });

  return pool;
}

export async function getDBConnection(): Promise<PoolConnection> {
  return await getPool().getConnection();
}
