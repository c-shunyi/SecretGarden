const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET || "please_change_me";
const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || "7d";

function signAccessToken(user) {
  return jwt.sign(
    {
      uid: user.id,
      tv: Number(user.token_version || 0),
    },
    jwtSecret,
    {
      expiresIn: accessTokenExpiresIn,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
