import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return Response.unauthorized(res, 'Token无效');
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return Response.unauthorized(res, '用户不存在');
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    return next();
  } catch (error) {
    Logger.warn('Token验证失败:', error);
    return Response.unauthorized(res, 'Token无效');
  }
};
