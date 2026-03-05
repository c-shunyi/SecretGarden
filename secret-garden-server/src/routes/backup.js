const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
const { query, withTransaction } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../utils/app-error");

const router = express.Router();

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_TABLES = [
  "users",
  "invitations",
  "bills",
  "files",
  "checkin_plans",
  "checkin_plan_members",
  "checkin_posts",
  "checkin_post_images",
];

const projectRootDir = path.resolve(__dirname, "../..");
const configuredStorageRoot = process.env.FILE_STORAGE_ROOT || "storage";
const storageRootDir = path.isAbsolute(configuredStorageRoot)
  ? configuredStorageRoot
  : path.resolve(projectRootDir, configuredStorageRoot);

function resolveImportMaxBytes() {
  const maxMb = Number(process.env.BACKUP_IMPORT_MAX_MB || 512);
  if (!Number.isFinite(maxMb) || maxMb <= 0) {
    return 512 * 1024 * 1024;
  }
  return Math.floor(maxMb * 1024 * 1024);
}

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: resolveImportMaxBytes(),
  },
});

function uploadSingleZip(req, res, next) {
  importUpload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(
        new AppError(
          400,
          "BACKUP_FILE_TOO_LARGE",
          `backup file exceeds size limit: ${Math.floor(resolveImportMaxBytes() / 1024 / 1024)}MB`
        )
      );
      return;
    }

    next(error);
  });
}

function ensureBackupPermission(req) {
  const ownerIdRaw = String(process.env.BACKUP_OWNER_USER_ID || "").trim();
  if (!ownerIdRaw) return;

  const ownerId = Number(ownerIdRaw);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new AppError(500, "BACKUP_OWNER_INVALID", "BACKUP_OWNER_USER_ID is invalid");
  }

  if (Number(req.user?.id) !== ownerId) {
    throw new AppError(403, "FORBIDDEN", "you are not allowed to use backup APIs");
  }
}

function pathExists(targetPath) {
  return fsPromises
    .access(targetPath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

function normalizeStoragePath(value) {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");

  if (!normalized || normalized.includes("..")) {
    throw new AppError(400, "INVALID_STORAGE_PATH", "invalid storage path in backup");
  }

  return normalized;
}

function resolveInside(baseDir, relativePath) {
  const segments = String(relativePath || "")
    .split("/")
    .filter(Boolean);
  const absolutePath = path.resolve(baseDir, ...segments);
  const safeRoot = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;

  if (absolutePath !== baseDir && !absolutePath.startsWith(safeRoot)) {
    throw new AppError(400, "INVALID_STORAGE_PATH", "unsafe path");
  }

  return absolutePath;
}

async function copyDirectory(sourceDir, targetDir) {
  const sourceExists = await pathExists(sourceDir);
  await fsPromises.mkdir(targetDir, { recursive: true });
  if (!sourceExists) return;

  const entries = await fsPromises.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
      await fsPromises.copyFile(sourcePath, targetPath);
    }
  }
}

async function buildBackupPayload() {
  const tables = {};
  for (const tableName of BACKUP_TABLES) {
    tables[tableName] = await query(`SELECT * FROM \`${tableName}\` ORDER BY id ASC`);
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

async function splitFileRowsByStorageExistence(fileRows) {
  const validRows = [];
  const missingRows = [];

  for (const row of fileRows || []) {
    const storagePath = normalizeStoragePath(row.storage_path);
    const absolutePath = resolveInside(storageRootDir, storagePath);
    const exists = await pathExists(absolutePath);

    if (!exists) {
      missingRows.push({
        id: Number(row.id),
        storagePath,
      });
      continue;
    }

    validRows.push({
      ...row,
      storage_path: storagePath,
    });
  }

  return { validRows, missingRows };
}

function pruneMissingFilesFromPayload(payload, missingRows) {
  if (!missingRows?.length) return;

  const missingIdSet = new Set(missingRows.map((item) => Number(item.id)));

  payload.tables.files = (payload.tables.files || []).filter(
    (row) => !missingIdSet.has(Number(row.id))
  );

  payload.tables.checkin_post_images = (payload.tables.checkin_post_images || []).filter(
    (row) => !missingIdSet.has(Number(row.file_id))
  );

  payload.tables.users = (payload.tables.users || []).map((row) => {
    if (missingIdSet.has(Number(row.avatar_file_id))) {
      return {
        ...row,
        avatar_file_id: null,
      };
    }
    return row;
  });

  payload.warnings = {
    ...(payload.warnings || {}),
    missingFiles: missingRows,
  };
}

async function addStorageFilesToZip(zip, fileRows) {
  const seenPaths = new Set();
  for (const row of fileRows || []) {
    const storagePath = normalizeStoragePath(row.storage_path);
    if (seenPaths.has(storagePath)) continue;
    seenPaths.add(storagePath);

    const absolutePath = resolveInside(storageRootDir, storagePath);
    let content;
    try {
      content = await fsPromises.readFile(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new AppError(409, "BACKUP_FILE_MISSING", `storage file not found: ${storagePath}`);
      }
      throw error;
    }
    zip.addFile(path.posix.join("storage", storagePath), content);
  }
}

function readBackupPayload(zip) {
  const backupEntry = zip.getEntry("backup.json");
  if (!backupEntry) {
    throw new AppError(400, "BACKUP_INVALID", "backup.json is missing");
  }

  let payload;
  try {
    const raw = backupEntry.getData().toString("utf8");
    payload = JSON.parse(raw);
  } catch {
    throw new AppError(400, "BACKUP_INVALID", "backup.json is invalid");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Number(payload.schemaVersion) !== BACKUP_SCHEMA_VERSION ||
    !payload.tables ||
    typeof payload.tables !== "object"
  ) {
    throw new AppError(400, "BACKUP_INVALID", "backup payload is invalid");
  }

  for (const tableName of BACKUP_TABLES) {
    if (!Array.isArray(payload.tables[tableName])) {
      throw new AppError(400, "BACKUP_INVALID", `backup table is invalid: ${tableName}`);
    }
  }

  return payload;
}

async function extractStorageToStage(zip, fileRows, stageStorageDir) {
  await fsPromises.mkdir(stageStorageDir, { recursive: true });

  const seen = new Set();
  for (const row of fileRows || []) {
    const storagePath = normalizeStoragePath(row.storage_path);
    if (seen.has(storagePath)) continue;
    seen.add(storagePath);

    const zipPath = path.posix.join("storage", storagePath);
    const entry = zip.getEntry(zipPath);
    if (!entry) {
      throw new AppError(400, "BACKUP_INVALID", `file missing in zip: ${zipPath}`);
    }

    const targetPath = resolveInside(stageStorageDir, storagePath);
    await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
    await fsPromises.writeFile(targetPath, entry.getData());
  }
}

async function insertTableRows(connection, tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const columns = Array.from(
    rows.reduce((set, row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new AppError(400, "BACKUP_INVALID", `invalid row in table ${tableName}`);
      }
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  if (!columns.length) return;

  const columnSql = columns.map((column) => `\`${column}\``).join(", ");
  const placeholderSql = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO \`${tableName}\` (${columnSql}) VALUES (${placeholderSql})`;

  for (const row of rows) {
    const values = columns.map((column) => {
      const value = row[column];
      return value === undefined ? null : value;
    });
    await connection.execute(sql, values);
  }
}

async function restoreDatabaseFromBackup(tableMap) {
  await withTransaction(async (connection) => {
    await connection.execute("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const tableName of [...BACKUP_TABLES].reverse()) {
        await connection.execute(`DELETE FROM \`${tableName}\``);
      }

      for (const tableName of BACKUP_TABLES) {
        await insertTableRows(connection, tableName, tableMap[tableName] || []);
      }
    } finally {
      await connection.execute("SET FOREIGN_KEY_CHECKS = 1");
    }
  });
}

async function withSwappedStorage(stageStorageDir, handler) {
  const currentExists = await pathExists(storageRootDir);
  const backupStorageDir = `${storageRootDir}.backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  if (currentExists) {
    await fsPromises.rename(storageRootDir, backupStorageDir);
  }

  try {
    await copyDirectory(stageStorageDir, storageRootDir);
    await handler();
    if (currentExists) {
      await fsPromises.rm(backupStorageDir, { recursive: true, force: true });
    }
  } catch (error) {
    await fsPromises.rm(storageRootDir, { recursive: true, force: true }).catch(() => {});
    if (currentExists) {
      await fsPromises.rename(backupStorageDir, storageRootDir).catch(() => {});
    }
    throw error;
  }
}

router.get(
  "/export",
  authRequired,
  asyncHandler(async (req, res) => {
    ensureBackupPermission(req);

    const payload = await buildBackupPayload();
    const { missingRows } = await splitFileRowsByStorageExistence(payload.tables.files || []);
    pruneMissingFilesFromPayload(payload, missingRows);

    const zip = new AdmZip();

    zip.addFile("backup.json", Buffer.from(JSON.stringify(payload, null, 2), "utf8"));
    await addStorageFilesToZip(zip, payload.tables.files || []);

    if (missingRows.length) {
      zip.addFile(
        "backup-warnings.json",
        Buffer.from(
          JSON.stringify(
            {
              message: "Some file records were skipped because physical files were missing.",
              missingFiles: missingRows,
            },
            null,
            2
          ),
          "utf8"
        )
      );
      res.setHeader("X-Backup-Warning-Count", String(missingRows.length));
    }

    const buffer = zip.toBuffer();
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const filename = `secret-garden-backup-${stamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  })
);

router.post(
  "/import",
  authRequired,
  uploadSingleZip,
  asyncHandler(async (req, res) => {
    ensureBackupPermission(req);

    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      throw new AppError(400, "BACKUP_FILE_REQUIRED", "please upload backup zip by field 'file'");
    }

    let zip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch {
      throw new AppError(400, "BACKUP_INVALID", "backup file is not a valid zip");
    }

    const payload = readBackupPayload(zip);
    const stageDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "sg-restore-"));
    const stageStorageDir = path.join(stageDir, "storage");

    try {
      await extractStorageToStage(zip, payload.tables.files || [], stageStorageDir);

      await withSwappedStorage(stageStorageDir, async () => {
        await restoreDatabaseFromBackup(payload.tables);
      });
    } finally {
      await fsPromises.rm(stageDir, { recursive: true, force: true }).catch(() => {});
    }

    const tableStats = BACKUP_TABLES.reduce((acc, tableName) => {
      acc[tableName] = Array.isArray(payload.tables[tableName]) ? payload.tables[tableName].length : 0;
      return acc;
    }, {});

    res.json({
      message: "imported successfully",
      importedAt: new Date().toISOString(),
      stats: {
        tables: tableStats,
        fileCount: tableStats.files || 0,
      },
    });
  })
);

module.exports = router;
