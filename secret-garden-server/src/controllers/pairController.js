import crypto from 'crypto';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Pair from '../models/Pair.js';
import PairInvite from '../models/PairInvite.js';
import User from '../models/User.js';

const findActivePairByUserId = async (userId) => {
  return Pair.findOne({
    where: {
      status: 'active',
      [Op.or]: [{ userAId: userId }, { userBId: userId }]
    }
  });
};

const generateInviteCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const exists = await PairInvite.findOne({ where: { code } });
    if (!exists) {
      return code;
    }
  }
  throw new Error('邀请码生成失败');
};

export const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const pair = await findActivePairByUserId(userId);

    if (!pair) {
      return Response.success(res, { paired: false }, '未绑定');
    }

    const partnerId = pair.userAId === userId ? pair.userBId : pair.userAId;
    const partner = await User.findByPk(partnerId, {
      attributes: ['id', 'username']
    });

    return Response.success(
      res,
      {
        paired: true,
        pair: {
          id: pair.id,
          boundAt: pair.boundAt || pair.createdAt
        },
        partner
      },
      '获取成功'
    );
  } catch (error) {
    Logger.error('获取绑定状态失败:', error);
    return Response.serverError(res, error.message || '获取绑定状态失败');
  }
};

export const createInvite = async (req, res) => {
  try {
    const userId = req.user.id;
    const existingPair = await findActivePairByUserId(userId);

    if (existingPair) {
      return Response.validationError(res, '你已经绑定过了');
    }

    const inputTtl = Number(req.body?.ttlMinutes ?? 60);
    const ttlMinutes =
      Number.isFinite(inputTtl) && inputTtl >= 5 && inputTtl <= 1440
        ? inputTtl
        : 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await PairInvite.update(
      { status: 'canceled' },
      { where: { inviterId: userId, status: 'pending' } }
    );

    const code = await generateInviteCode();
    const invite = await PairInvite.create({
      inviterId: userId,
      code,
      status: 'pending',
      expiresAt
    });

    Logger.success('创建绑定邀请码成功', {
      userId,
      inviteId: invite.id
    });

    return Response.success(
      res,
      { code: invite.code, expiresAt: invite.expiresAt },
      '创建成功'
    );
  } catch (error) {
    Logger.error('创建绑定邀请码失败:', error);
    return Response.serverError(res, error.message || '创建邀请码失败');
  }
};

export const acceptInvite = async (req, res) => {
  try {
    const userId = req.user.id;
    const rawCode = req.body?.code;
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';

    if (!code) {
      return Response.validationError(res, '邀请码不能为空');
    }

    const invite = await PairInvite.findOne({ where: { code } });
    if (!invite) {
      return Response.notFound(res, '邀请码不存在');
    }

    if (invite.status !== 'pending') {
      return Response.validationError(res, '邀请码已失效');
    }

    if (invite.inviterId === userId) {
      return Response.validationError(res, '不能绑定自己');
    }

    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      await invite.update({ status: 'expired' });
      return Response.validationError(res, '邀请码已过期');
    }

    const [selfPair, inviterPair] = await Promise.all([
      findActivePairByUserId(userId),
      findActivePairByUserId(invite.inviterId)
    ]);

    if (selfPair) {
      return Response.validationError(res, '你已经绑定过了');
    }

    if (inviterPair) {
      return Response.validationError(res, '对方已绑定');
    }

    const now = new Date();
    const pair = await sequelize.transaction(async (transaction) => {
      const createdPair = await Pair.create(
        {
          userAId: invite.inviterId,
          userBId: userId,
          status: 'active',
          boundAt: now
        },
        { transaction }
      );

      await invite.update(
        { status: 'accepted', acceptedBy: userId, acceptedAt: now },
        { transaction }
      );

      return createdPair;
    });

    const partner = await User.findByPk(invite.inviterId, {
      attributes: ['id', 'username']
    });

    Logger.success('绑定成功', {
      pairId: pair.id,
      inviterId: invite.inviterId,
      accepterId: userId
    });

    return Response.success(
      res,
      {
        pair: { id: pair.id, boundAt: pair.boundAt },
        partner
      },
      '绑定成功'
    );
  } catch (error) {
    Logger.error('绑定失败:', error);
    return Response.serverError(res, error.message || '绑定失败');
  }
};
