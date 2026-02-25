const express = require("express");
const bcrypt = require("bcryptjs");
const { execute, queryOne } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { AppError } = require("../utils/app-error");
const { asyncHandler } = require("../utils/async-handler");
const { signAccessToken } = require("../utils/jwt");
const { toUserProfile } = require("../utils/user-view");

const router = express.Router();

function normalizeAccount(value) {
  return String(value || "").trim();
}

function validateAccount(account) {
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(account)) {
    throw new AppError(400, "INVALID_ACCOUNT", "账号需为 4-20 位字母、数字或下划线");
  }
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 6 || password.length > 32) {
    throw new AppError(400, "INVALID_PASSWORD", "密码长度需在 6-32 位");
  }
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const account = normalizeAccount(req.body.account);
    const password = req.body.password;

    validateAccount(account);
    validatePassword(password);

    const existing = await queryOne("SELECT id FROM users WHERE account = ?", [account]);
    if (existing) {
      throw new AppError(409, "ACCOUNT_EXISTS", "账号已存在");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await execute(
      "INSERT INTO users (account, password_hash, nickname) VALUES (?, ?, ?)",
      [account, passwordHash, account]
    );

    const user = await queryOne(
      "SELECT id, account, nickname, birthday, bio, avatar_file_id, partner_id, token_version, created_at, updated_at FROM users WHERE id = ?",
      [insertResult.insertId]
    );

    const accessToken = signAccessToken(user);

    res.status(201).json({
      accessToken,
      user: toUserProfile(user),
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const account = normalizeAccount(req.body.account);
    const password = req.body.password;

    validateAccount(account);
    validatePassword(password);

    const user = await queryOne(
      "SELECT id, account, nickname, birthday, bio, avatar_file_id, partner_id, token_version, created_at, updated_at, password_hash FROM users WHERE account = ?",
      [account]
    );

    if (!user) {
      throw new AppError(401, "LOGIN_FAILED", "账号或密码错误");
    }

    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) {
      throw new AppError(401, "LOGIN_FAILED", "账号或密码错误");
    }

    const accessToken = signAccessToken(user);

    res.json({
      accessToken,
      user: toUserProfile(user),
    });
  })
);

router.post(
  "/logout",
  authRequired,
  asyncHandler(async (req, res) => {
    await execute("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [req.user.id]);
    res.json({ message: "退出成功" });
  })
);

module.exports = router;
