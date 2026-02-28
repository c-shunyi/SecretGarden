const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const { execute, query, queryOne } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/async-handler");
const { AppError } = require("../utils/app-error");

const router = express.Router();

const projectRootDir = path.resolve(__dirname, "../..");
const configuredStorageRoot = process.env.FILE_STORAGE_ROOT || "storage";
const storageRootDir = path.isAbsolute(configuredStorageRoot)
  ? configuredStorageRoot
  : path.resolve(projectRootDir, configuredStorageRoot);
const storageNamespace = "users";

function resolveMaxUploadBytes() {
  const maxMb = Number(process.env.FILE_MAX_SIZE_MB || 20);
  if (!Number.isFinite(maxMb) || maxMb <= 0) {
    return 20 * 1024 * 1024;
  }
  return Math.floor(maxMb * 1024 * 1024);
}

const maxUploadBytes = resolveMaxUploadBytes();

function normalizeOriginalName(value) {
  const raw = path.basename(String(value || "file").trim());
  const cleaned = raw.replace(/[\r\n\t]/g, "") || "file";
  return cleaned.length > 255 ? cleaned.slice(-255) : cleaned;
}

function normalizeFileExt(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  if (!ext) return "";
  return ext.replace(/[^a-z0-9.]/g, "").slice(0, 16);
}

function generateStoredFileName(originalName) {
  const ext = normalizeFileExt(originalName);
  const random = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${random}${ext}`;
}

async function ensureUserStorageDir(userId) {
  const dir = path.join(storageRootDir, storageNamespace, String(userId));
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}

function toStoragePath(userId, storedFileName) {
  return path.posix.join(storageNamespace, String(userId), storedFileName);
}

function toAbsoluteStoragePath(storagePath) {
  const segments = String(storagePath || "")
    .split("/")
    .filter(Boolean);
  const absolute = path.resolve(storageRootDir, ...segments);
  const safeRoot = storageRootDir.endsWith(path.sep)
    ? storageRootDir
    : `${storageRootDir}${path.sep}`;

  if (absolute !== storageRootDir && !absolute.startsWith(safeRoot)) {
    throw new AppError(500, "INVALID_STORAGE_PATH", "Invalid storage path");
  }

  return absolute;
}

function toFileView(row) {
  return {
    id: Number(row.id),
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
    contentUrl: `/api/v1/files/${row.id}/content`,
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        if (!req.user || !req.user.id) {
          throw new AppError(401, "UNAUTHORIZED", "Missing authenticated user");
        }
        const userDir = await ensureUserStorageDir(req.user.id);
        cb(null, userDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      try {
        const originalName = normalizeOriginalName(file.originalname);
        cb(null, generateStoredFileName(originalName));
      } catch (error) {
        cb(error);
      }
    },
  }),
  limits: {
    fileSize: maxUploadBytes,
  },
});

function uploadSingleFile(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new AppError(
            400,
            "FILE_TOO_LARGE",
            `File exceeds size limit: ${Math.floor(maxUploadBytes / 1024 / 1024)}MB`
          )
        );
        return;
      }
      next(new AppError(400, "UPLOAD_FAILED", error.message));
      return;
    }

    next(error);
  });
}

function parseFileId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "INVALID_FILE_ID", "Invalid file id");
  }
  return id;
}

function authFromQueryToken(req, res, next) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    next();
    return;
  }

  const raw = req.query.access_token;
  const token = Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
  if (!token) {
    next();
    return;
  }

  req.headers.authorization = `Bearer ${token}`;
  next();
}

router.post(
  "/upload",
  authRequired,
  uploadSingleFile,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "FILE_REQUIRED", "Please upload file by field 'file'");
    }

    const userId = Number(req.user.id);
    const originalName = normalizeOriginalName(req.file.originalname);
    const mimeType = String(req.file.mimetype || "application/octet-stream");
    const sizeBytes = Number(req.file.size || 0);
    const storagePath = toStoragePath(userId, req.file.filename);

    let createdId;
    try {
      const result = await execute(
        `
          INSERT INTO files (user_id, original_name, mime_type, size_bytes, storage_path)
          VALUES (?, ?, ?, ?, ?)
        `,
        [userId, originalName, mimeType, sizeBytes, storagePath]
      );
      createdId = result.insertId;
    } catch (error) {
      await fsPromises.unlink(req.file.path).catch(() => {});
      throw error;
    }

    const created = await queryOne(
      `
        SELECT id, user_id, original_name, mime_type, size_bytes, storage_path, created_at
        FROM files
        WHERE id = ? AND user_id = ?
      `,
      [createdId, userId]
    );

    res.status(201).json({
      file: toFileView(created),
    });
  })
);

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const rawLimit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      throw new AppError(400, "INVALID_LIMIT", "limit must be integer between 1 and 100");
    }
    const safeLimit = rawLimit;

    const rows = await query(
      `
        SELECT id, user_id, original_name, mime_type, size_bytes, storage_path, created_at
        FROM files
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ${safeLimit}
      `,
      [req.user.id]
    );

    res.json({
      files: rows.map(toFileView),
    });
  })
);

router.get(
  "/:id/content",
  authFromQueryToken,
  authRequired,
  asyncHandler(async (req, res) => {
    const id = parseFileId(req.params.id);
    const row = await queryOne(
      `
        SELECT id, user_id, original_name, mime_type, size_bytes, storage_path
        FROM files
        WHERE id = ? AND user_id = ?
      `,
      [id, req.user.id]
    );

    if (!row) {
      throw new AppError(404, "FILE_NOT_FOUND", "File not found");
    }

    const absolutePath = toAbsoluteStoragePath(row.storage_path);
    await fsPromises.access(absolutePath, fs.constants.R_OK).catch(() => {
      throw new AppError(404, "FILE_CONTENT_MISSING", "File content not found");
    });

    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
    );
    res.type(row.mime_type || "application/octet-stream");
    res.sendFile(absolutePath);
  })
);

router.delete(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const id = parseFileId(req.params.id);
    const row = await queryOne(
      `
        SELECT id, user_id, storage_path
        FROM files
        WHERE id = ? AND user_id = ?
      `,
      [id, req.user.id]
    );

    if (!row) {
      throw new AppError(404, "FILE_NOT_FOUND", "File not found");
    }

    await execute("DELETE FROM files WHERE id = ? AND user_id = ?", [id, req.user.id]);

    const absolutePath = toAbsoluteStoragePath(row.storage_path);
    await fsPromises.unlink(absolutePath).catch((error) => {
      if (error && error.code !== "ENOENT") {
        throw error;
      }
    });

    res.json({
      message: "Deleted successfully",
    });
  })
);

module.exports = router;
