const { queryOne } = require("../db/mysql");
const { AppError } = require("../utils/app-error");
const { verifyAccessToken } = require("../utils/jwt");

async function authRequired(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "缺少 Bearer Token");
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Token 为空");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      throw new AppError(401, "UNAUTHORIZED", "Token 无效或已过期");
    }

    const user = await queryOne(
      "SELECT id, account, nickname, birthday, bio, avatar_file_id, partner_id, token_version, created_at, updated_at FROM users WHERE id = ?",
      [payload.uid]
    );

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "用户不存在");
    }

    if (Number(payload.tv) !== Number(user.token_version)) {
      throw new AppError(401, "UNAUTHORIZED", "登录状态已失效，请重新登录");
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authRequired,
};
