import mysql, { Pool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

declare global {
  var _cargoTraceMysqlPool: Pool | undefined;
}

export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

export function getMysqlConfigFromEnv(): MysqlConnectionConfig | null {
  const host = process.env.DB_HOST || process.env.MYSQL_HOST;
  const database = process.env.DB_DATABASE || process.env.MYSQL_DATABASE;
  const user = process.env.DB_USERNAME || process.env.MYSQL_USER;
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
  const port = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);

  if (!host || !database || !user) {
    return null;
  }

  return { host, port, user, password, database };
}

/**
 * Lazily returns a MySQL 8.0 connection pool when DB_HOST / DB_DATABASE / DB_USERNAME
 * are configured on the VPS (matches Laravel .env configuration).
 */
export function getMysqlPool(): Pool | null {
  const cfg = getMysqlConfigFromEnv();
  if (!cfg) return null;

  if (!global._cargoTraceMysqlPool) {
    global._cargoTraceMysqlPool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 10,
      multipleStatements: true,
      timezone: 'Z',
    });
  }

  return global._cargoTraceMysqlPool;
}

/**
 * Executes database/mysql_schema_and_seed.sql on the configured MySQL 8.0 database
 * when running on a VPS if tables have not yet been initialized.
 */
export async function ensureMysqlSchemaSeeded(): Promise<{
  connected: boolean;
  driver: 'mysql' | 'embedded-relational';
  tablesCount: number;
}> {
  const pool = getMysqlPool();
  if (!pool) {
    return {
      connected: false,
      driver: 'embedded-relational',
      tablesCount: 10,
    };
  }

  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SHOW TABLES LIKE "shipments"');
    if (rows.length === 0) {
      const sqlFile = path.resolve(process.cwd(), 'database', 'mysql_schema_and_seed.sql');
      if (fs.existsSync(sqlFile)) {
        const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
        await pool.query(sqlContent);
      }
    }
    return {
      connected: true,
      driver: 'mysql',
      tablesCount: 10,
    };
  } catch {
    return {
      connected: false,
      driver: 'embedded-relational',
      tablesCount: 10,
    };
  }
}
