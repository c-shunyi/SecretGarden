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

  await execute(`
    CREATE TABLE IF NOT EXISTS bills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      bill_type ENUM('EXPENSE', 'INCOME') NOT NULL DEFAULT 'EXPENSE',
      category VARCHAR(32) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      note VARCHAR(255) NULL,
      bill_date DATE NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_bills_user_date (user_id, bill_date),
      CONSTRAINT fk_bills_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS files (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT UNSIGNED NOT NULL,
      storage_path VARCHAR(500) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_files_storage_path (storage_path),
      KEY idx_files_user_id_created_at (user_id, created_at),
      CONSTRAINT fk_files_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS checkin_plans (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      description VARCHAR(255) NULL,
      invite_code VARCHAR(20) NOT NULL UNIQUE,
      creator_id BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_checkin_plans_creator_id (creator_id),
      CONSTRAINT fk_checkin_plans_creator_id
        FOREIGN KEY (creator_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS checkin_plan_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      plan_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('OWNER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_checkin_plan_members_plan_user (plan_id, user_id),
      KEY idx_checkin_plan_members_user_id (user_id),
      CONSTRAINT fk_checkin_plan_members_plan_id
        FOREIGN KEY (plan_id) REFERENCES checkin_plans(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_checkin_plan_members_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS checkin_posts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      plan_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      content VARCHAR(2000) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_checkin_posts_plan_created (plan_id, created_at),
      KEY idx_checkin_posts_user_id (user_id),
      CONSTRAINT fk_checkin_posts_plan_id
        FOREIGN KEY (plan_id) REFERENCES checkin_plans(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_checkin_posts_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS checkin_post_images (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      post_id BIGINT UNSIGNED NOT NULL,
      file_id BIGINT UNSIGNED NOT NULL,
      sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_checkin_post_images_post_file (post_id, file_id),
      UNIQUE KEY uk_checkin_post_images_post_sort (post_id, sort_order),
      KEY idx_checkin_post_images_file_id (file_id),
      CONSTRAINT fk_checkin_post_images_post_id
        FOREIGN KEY (post_id) REFERENCES checkin_posts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_checkin_post_images_file_id
        FOREIGN KEY (file_id) REFERENCES files(id)
        ON DELETE RESTRICT
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
