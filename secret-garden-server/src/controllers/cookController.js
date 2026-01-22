import { Op } from 'sequelize';
import CookRecord from '../models/CookRecord.js';
import Pair from '../models/Pair.js';
import User from '../models/User.js';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const findActivePairByUserId = async (userId) => {
  return Pair.findOne({
    where: {
      status: 'active',
      [Op.or]: [{ userAId: userId }, { userBId: userId }]
    }
  });
};

export const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const pair = await findActivePairByUserId(userId);

    if (!pair) {
      return Response.validationError(res, '请先绑定');
    }

    const today = getLocalDateString();
    const [todayCount, lastRecord] = await Promise.all([
      CookRecord.count({ where: { pairId: pair.id, recordDate: today } }),
      CookRecord.findOne({
        where: { pairId: pair.id },
        order: [['createdAt', 'DESC']]
      })
    ]);

    let lastRecordBy = null;
    if (lastRecord) {
      lastRecordBy = await User.findByPk(lastRecord.userId, {
        attributes: ['id', 'username']
      });
    }

    return Response.success(
      res,
      {
        hasRecordToday: todayCount > 0,
        todayCount,
        lastRecordAt: lastRecord ? lastRecord.createdAt : null,
        lastRecordBy
      },
      '获取成功'
    );
  } catch (error) {
    Logger.error('获取记录状态失败:', error);
    return Response.serverError(res, error.message || '获取记录状态失败');
  }
};

export const createRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const pair = await findActivePairByUserId(userId);

    if (!pair) {
      return Response.validationError(res, '请先绑定');
    }

    const today = getLocalDateString();
    const record = await CookRecord.create({
      pairId: pair.id,
      userId,
      recordDate: today
    });

    const todayCount = await CookRecord.count({
      where: { pairId: pair.id, recordDate: today }
    });

    Logger.success('记录炒菜成功', {
      userId,
      pairId: pair.id,
      recordId: record.id
    });

    return Response.success(
      res,
      {
        record,
        todayCount,
        hasRecordToday: true
      },
      '记录成功',
      201
    );
  } catch (error) {
    Logger.error('记录炒菜失败:', error);
    return Response.serverError(res, error.message || '记录失败');
  }
};
