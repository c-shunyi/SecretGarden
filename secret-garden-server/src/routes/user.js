const express = require("express");
const { execute, queryOne } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { AppError } = require("../utils/app-error");
const { asyncHandler } = require("../utils/async-handler");
const { toUserProfile } = require("../utils/user-view");

const router = express.Router();

function validateBirthday(value) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "INVALID_BIRTHDAY", "生日格式需为 YYYY-MM-DD");
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_BIRTHDAY", "生日不是有效日期");
  }

  return value;
}

router.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({
      user: toUserProfile(req.user),
    });
  })
);

router.patch(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    const fields = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "nickname")) {
      const nickname =
        req.body.nickname === null ? null : String(req.body.nickname).trim();
      if (nickname !== null && (nickname.length < 1 || nickname.length > 30)) {
        throw new AppError(400, "INVALID_NICKNAME", "昵称长度需在 1-30 位");
      }
      fields.push("nickname = ?");
      params.push(nickname);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "bio")) {
      const bio = req.body.bio === null ? null : String(req.body.bio).trim();
      if (bio !== null && bio.length > 500) {
        throw new AppError(400, "INVALID_BIO", "个人简介不能超过 500 字");
      }
      fields.push("bio = ?");
      params.push(bio);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "birthday")) {
      const birthday = validateBirthday(req.body.birthday);
      fields.push("birthday = ?");
      params.push(birthday);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "avatarFileId")) {
      const avatarFileId = req.body.avatarFileId;
      if (avatarFileId !== null && (!Number.isInteger(avatarFileId) || avatarFileId <= 0)) {
        throw new AppError(400, "INVALID_AVATAR_FILE_ID", "avatarFileId 必须是正整数或 null");
      }
      fields.push("avatar_file_id = ?");
      params.push(avatarFileId);
    }

    if (!fields.length) {
      throw new AppError(400, "EMPTY_UPDATE", "没有可更新字段");
    }

    params.push(req.user.id);
    await execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);

    const freshUser = await queryOne(
      "SELECT id, account, nickname, birthday, bio, avatar_file_id, partner_id, token_version, created_at, updated_at FROM users WHERE id = ?",
      [req.user.id]
    );

    res.json({
      user: toUserProfile(freshUser),
    });
  })
);

module.exports = router;
