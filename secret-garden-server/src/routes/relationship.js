const express = require("express");
const { execute, queryOne, withTransaction } = require("../db/mysql");
const { authRequired } = require("../middlewares/auth");
const { AppError } = require("../utils/app-error");
const { asyncHandler } = require("../utils/async-handler");
const { toPartnerProfile } = require("../utils/user-view");

const router = express.Router();

function generateInviteCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createUniqueInviteCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = generateInviteCode();
    const existing = await queryOne("SELECT id FROM invitations WHERE code = ?", [code]);
    if (!existing) {
      return code;
    }
  }
  throw new AppError(500, "INVITE_CODE_FAILED", "邀请码生成失败，请重试");
}

router.get(
  "/status",
  authRequired,
  asyncHandler(async (req, res) => {
    const me = await queryOne(
      "SELECT id, partner_id FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!me || !me.partner_id) {
      res.json({ bound: false, partner: null });
      return;
    }

    const partner = await queryOne(
      "SELECT id, account, nickname, avatar_file_id FROM users WHERE id = ?",
      [me.partner_id]
    );

    if (!partner) {
      await execute("UPDATE users SET partner_id = NULL WHERE id = ?", [me.id]);
      res.json({ bound: false, partner: null });
      return;
    }

    res.json({
      bound: true,
      partner: toPartnerProfile(partner),
    });
  })
);

router.post(
  "/invite",
  authRequired,
  asyncHandler(async (req, res) => {
    const me = await queryOne("SELECT id, partner_id FROM users WHERE id = ?", [req.user.id]);
    if (!me) {
      throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
    }
    if (me.partner_id) {
      throw new AppError(400, "ALREADY_BOUND", "当前已绑定伴侣，无法生成邀请码");
    }

    await execute(
      "UPDATE invitations SET status = 'EXPIRED' WHERE status = 'OPEN' AND expires_at <= UTC_TIMESTAMP()"
    );
    await execute(
      "UPDATE invitations SET status = 'CANCELLED' WHERE inviter_id = ? AND status = 'OPEN'",
      [me.id]
    );

    const code = await createUniqueInviteCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await execute(
      "INSERT INTO invitations (code, inviter_id, expires_at, status) VALUES (?, ?, ?, 'OPEN')",
      [code, me.id, expiresAt]
    );

    res.status(201).json({
      code,
      expiresAt: expiresAt.toISOString(),
    });
  })
);

router.post(
  "/bind",
  authRequired,
  asyncHandler(async (req, res) => {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6,20}$/.test(code)) {
      throw new AppError(400, "INVALID_CODE", "邀请码格式不正确");
    }

    const partner = await withTransaction(async (connection) => {
      const [selfRows] = await connection.execute(
        "SELECT id, partner_id FROM users WHERE id = ? FOR UPDATE",
        [req.user.id]
      );
      const me = selfRows[0];
      if (!me) {
        throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
      }
      if (me.partner_id) {
        throw new AppError(400, "ALREADY_BOUND", "你已经绑定过伴侣");
      }

      const [inviteRows] = await connection.execute(
        "SELECT id, code, inviter_id, status, expires_at FROM invitations WHERE code = ? FOR UPDATE",
        [code]
      );
      const invite = inviteRows[0];
      if (!invite) {
        throw new AppError(404, "INVITE_NOT_FOUND", "邀请码不存在");
      }
      if (invite.status !== "OPEN") {
        throw new AppError(400, "INVITE_UNAVAILABLE", "邀请码不可用");
      }
      if (new Date(invite.expires_at).getTime() <= Date.now()) {
        await connection.execute(
          "UPDATE invitations SET status = 'EXPIRED' WHERE id = ?",
          [invite.id]
        );
        throw new AppError(400, "INVITE_EXPIRED", "邀请码已过期");
      }
      if (Number(invite.inviter_id) === Number(me.id)) {
        throw new AppError(400, "INVALID_BIND_TARGET", "不能绑定自己生成的邀请码");
      }

      const [inviterRows] = await connection.execute(
        "SELECT id, account, nickname, avatar_file_id, partner_id FROM users WHERE id = ? FOR UPDATE",
        [invite.inviter_id]
      );
      const inviter = inviterRows[0];
      if (!inviter) {
        throw new AppError(404, "INVITER_NOT_FOUND", "邀请码所属用户不存在");
      }
      if (inviter.partner_id) {
        await connection.execute(
          "UPDATE invitations SET status = 'CANCELLED' WHERE id = ?",
          [invite.id]
        );
        throw new AppError(400, "INVITER_ALREADY_BOUND", "邀请码所属用户已绑定伴侣");
      }

      await connection.execute("UPDATE users SET partner_id = ? WHERE id = ?", [inviter.id, me.id]);
      await connection.execute("UPDATE users SET partner_id = ? WHERE id = ?", [me.id, inviter.id]);
      await connection.execute(
        "UPDATE invitations SET status = 'USED', used_by_id = ?, used_at = UTC_TIMESTAMP() WHERE id = ?",
        [me.id, invite.id]
      );
      await connection.execute(
        "UPDATE invitations SET status = 'CANCELLED' WHERE inviter_id IN (?, ?) AND status = 'OPEN' AND id <> ?",
        [inviter.id, me.id, invite.id]
      );

      return inviter;
    });

    res.json({
      message: "绑定成功",
      partner: toPartnerProfile(partner),
    });
  })
);

router.post(
  "/unbind",
  authRequired,
  asyncHandler(async (req, res) => {
    const confirmText = String(req.body.confirmText || "").trim().toUpperCase();
    if (confirmText !== "UNBIND") {
      throw new AppError(400, "CONFIRM_REQUIRED", "解绑需传入 confirmText=UNBIND");
    }

    await withTransaction(async (connection) => {
      const [selfRows] = await connection.execute(
        "SELECT id, partner_id FROM users WHERE id = ? FOR UPDATE",
        [req.user.id]
      );
      const me = selfRows[0];
      if (!me || !me.partner_id) {
        throw new AppError(400, "NOT_BOUND", "当前未绑定伴侣");
      }

      const partnerId = Number(me.partner_id);
      await connection.execute("UPDATE users SET partner_id = NULL WHERE id IN (?, ?)", [
        me.id,
        partnerId,
      ]);
      await connection.execute(
        "UPDATE invitations SET status = 'CANCELLED' WHERE inviter_id IN (?, ?) AND status = 'OPEN'",
        [me.id, partnerId]
      );
    });

    res.json({ message: "解绑成功" });
  })
);

module.exports = router;
