import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import User from '../models/User.js';

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.password;
  return data;
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return Response.validationError(res, '用户名、邮箱和密码不能为空');
    }

    if (password.length < 6) {
      return Response.validationError(res, '密码至少6位');
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return Response.validationError(res, '用户名或邮箱已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword
    });

    const token = createToken(user);
    Logger.success('用户注册成功', { userId: user.id, username: user.username });

    return Response.success(
      res,
      { user: sanitizeUser(user), token },
      '注册成功',
      201
    );
  } catch (error) {
    Logger.error('用户注册失败:', error);
    return Response.serverError(res, error.message || '注册失败');
  }
};

export const login = async (req, res) => {
  try {
    const { account, username, email, password } = req.body;
    const identifier = account || username || email;

    if (!identifier || !password) {
      return Response.validationError(res, '账号或密码不能为空');
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [{ username: identifier }, { email: identifier }]
      }
    });

    if (!user) {
      return Response.unauthorized(res, '账号或密码错误');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return Response.unauthorized(res, '账号或密码错误');
    }

    const token = createToken(user);
    Logger.success('用户登录成功', { userId: user.id, username: user.username });

    return Response.success(res, { user: sanitizeUser(user), token }, '登录成功');
  } catch (error) {
    Logger.error('用户登录失败:', error);
    return Response.serverError(res, error.message || '登录失败');
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return Response.notFound(res, '用户不存在');
    }

    return Response.success(res, sanitizeUser(user), '获取成功');
  } catch (error) {
    Logger.error('获取用户信息失败:', error);
    return Response.serverError(res, error.message || '获取用户信息失败');
  }
};
