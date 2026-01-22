import 'dotenv/config';
import express from 'express';
import './utils/global.js';
import sequelize from './config/database.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  return Response.success(res, { status: 'ok' }, 'ok');
});

app.use('/api/auth', authRoutes);

app.use((req, res) => {
  return Response.notFound(res, '接口不存在');
});

const port = process.env.PORT || 3000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    Logger.error('缺少JWT_SECRET环境变量');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    Logger.success('数据库连接成功');

    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync();
      Logger.info('数据库同步完成');
    }

    app.listen(port, () => {
      Logger.success(`服务已启动: ${port}`);
    });
  } catch (error) {
    Logger.error('数据库连接失败:', error);
    process.exit(1);
  }
};

startServer();
