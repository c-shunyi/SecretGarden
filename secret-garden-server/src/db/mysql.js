const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "secret_garden",
};

let pool;

function assertDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("DB_NAME 仅支持字母、数字、下划线");
  }
}

async function initDatabase() {
  assertDatabaseName(dbConfig.database);

  const bootstrapConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrapConnection.end();

  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
  });

  await createTables();
}

async function createTables() {
  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      account VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      nickname VARCHAR(50) NULL,
      birthday DATE NULL,
      bio VARCHAR(500) NULL,
      avatar_file_id BIGINT UNSIGNED NULL,
      partner_id BIGINT UNSIGNED NULL,
      token_version INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_users_partner_id (partner_id),
      CONSTRAINT fk_users_partner_id
        FOREIGN KEY (partner_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS invitations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      inviter_id BIGINT UNSIGNED NOT NULL,
      used_by_id BIGINT UNSIGNED NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      status ENUM('OPEN', 'USED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_invitations_inviter_id (inviter_id),
      KEY idx_invitations_status_expires_at (status, expires_at),
      CONSTRAINT fk_invitations_inviter_id
        FOREIGN KEY (inviter_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_invitations_used_by_id
        FOREIGN KEY (used_by_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function ensurePool() {
  if (!pool) {
    throw new Error("数据库未初始化，请先执行 initDatabase()");
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await ensurePool().execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function execute(sql, params = []) {
  const [result] = await ensurePool().execute(sql, params);
  return result;
}

async function withTransaction(handler) {
  const connection = await ensurePool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  initDatabase,
  query,
  queryOne,
  execute,
  withTransaction,
};
