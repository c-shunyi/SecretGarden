# SecretGarden 开发规范指南

> 开发新功能时必须遵守的技术规范和标准

---

## 技术栈

### 前端 (secret-garden)
- uni-app
- Vue.js

### 后端 (secret-garden-server)
- Node.js
- Express.js
- sequelize
- ES6 Modules
- pnpm安装依赖

该程序前端仅打包为微信小程序，注意对小程序的适配性，也只需要考虑小程序即可

## 🎯 核心规范（强制遵守）

### 1. 日志规范 ⭐️

**必须使用 `Logger` 工具类，禁止使用 `console.log`**

```javascript
// ❌ 错误
console.log('用户登录')

// ✅ 正确
Logger.success('用户登录成功:', { username })
Logger.info('查询数据', { page, limit })
Logger.warn('积分不足', { balance: 5 })
Logger.error('操作失败:', error)
Logger.debug('调试信息:', data) // 仅开发环境
```

**日志方法：**
- `Logger.success()` - 成功操作（绿色）
- `Logger.info()` - 一般信息（蓝色）
- `Logger.warn()` - 警告信息（黄色）
- `Logger.error()` - 错误信息（红色）
- `Logger.debug()` - 调试信息（青色，仅开发环境）

### 2. 响应规范 ⭐️

**必须使用 `Response` 工具类统一返回格式**

```javascript
// ❌ 错误
res.json({ success: true, data: users })
res.status(400).send('参数错误')

// ✅ 正确
Response.success(res, { users }, '获取成功')
Response.success(res, { task }, '创建成功', 201) // 指定状态码
Response.validationError(res, '参数错误')
Response.unauthorized(res, 'Token无效')
Response.notFound(res, '资源不存在')
Response.serverError(res, error.message)
Response.paginate(res, list, total, page, limit) // 分页
```

**统一响应格式：**
```json
// 成功: { "code": 0, "data": {...}, "msg": "成功" }
// 失败: { "code": 400, "data": null, "msg": "错误信息" }
```

---

## 📁 项目结构

```
secret-garden-server/src/
├── index.js              # 入口文件
├── config/
│   └── database.js       # 数据库配置
├── controllers/          # 控制器（处理HTTP请求）
├── routes/               # 路由定义
├── models/               # 数据模型（Sequelize ORM）
├── middleware/
│   └── auth.js           # JWT认证中间件 (protect)
├── services/             # 业务逻辑服务层
└── utils/
    ├── logger.js         # ⭐️ 日志工具（全局可用）
    ├── response.js       # ⭐️ 响应工具（全局可用）
    └── global.js         # 全局工具注册
```

**技术栈：**
- **框架**: Express.js
- **ORM**: Sequelize + MySQL
- **认证**: JWT (7天有效期)
- **模块**: ES6 Modules (`import/export`)

---

## 🔧 开发模板

### Controller 标准结构

```javascript
export const someAction = async (req, res) => {
  try {
    // 1. 获取当前用户（protect中间件会注入）
    const userId = req.user.id;
    const username = req.user.username;

    // 2. 获取并验证参数
    const { param1, param2 } = req.body;
    if (!param1) {
      return Response.validationError(res, '缺少必填字段');
    }

    // 3. 执行业务逻辑
    const result = await SomeModel.findOne({
      where: { id: param1, userId } // ⚠️ 必须加userId隔离用户数据
    });

    if (!result) {
      return Response.notFound(res, '资源不存在');
    }

    // 4. 记录日志并返回
    Logger.success('操作成功', { userId, resultId: result.id });
    return Response.success(res, result, '操作成功');

  } catch (error) {
    // 5. 错误处理
    Logger.error('操作失败:', error);
    return Response.serverError(res, error.message || '操作失败');
  }
};
```

### 分页查询模板

```javascript
export const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const { count, rows } = await Model.findAndCountAll({
      where: { userId }, // ⚠️ 必须隔离用户数据
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });

    return Response.paginate(res, rows, count, page, limit);
  } catch (error) {
    Logger.error('获取列表失败:', error);
    return Response.serverError(res, error.message);
  }
};
```

---

## 🔐 认证规范

### 保护路由（强制）

```javascript
import { protect } from '../middleware/auth.js';

// 方式1: 保护所有路由
router.use(protect);

// 方式2: 保护单个路由
router.get('/me', protect, controller.getMe);
```

### 获取当前用户

```javascript
// protect 中间件会将用户信息注入到 req.user
const userId = req.user.id;           // 用户ID
const username = req.user.username;   // 用户名
const email = req.user.email;         // 邮箱
// ⚠️ req.user 不包含密码字段
```

---

## 📊 数据库规范

### Sequelize 查询模板

```javascript
// 查询单条
const item = await Model.findOne({
  where: { id: itemId, userId }, // ⚠️ 必须加userId
  attributes: { exclude: ['password'] } // 排除敏感字段
});

// 查询多条
const items = await Model.findAll({
  where: { userId, status: 'active' },
  order: [['createdAt', 'DESC']],
  limit: 10
});

// 分页查询
const { count, rows } = await Model.findAndCountAll({
  where: { userId },
  limit: parseInt(limit),
  offset: (page - 1) * limit
});

// 关联查询
const items = await Model.findAll({
  where: { userId },
  include: [
    { model: RelatedModel, as: 'relation' }
  ]
});
```

### 模型定义模板

```javascript
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ModelName = sequelize.define('ModelName', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '主键ID'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id', // 数据库字段名（snake_case）
    comment: '用户ID'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '标题'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending',
    comment: '状态'
  }
}, {
  tableName: 'table_name', // 表名
  timestamps: true,        // 自动管理 createdAt/updatedAt
  underscored: false,      // 不自动转换字段名
  indexes: [
    { fields: ['user_id'] },    // ⚠️ 外键必须加索引
    { fields: ['status'] },     // 常用查询字段加索引
    { fields: ['created_at'] }
  ]
});

export default ModelName;
```

---

## 🚀 新增功能开发流程

### 步骤 1: 创建路由
**文件**: `src/routes/xxxRoutes.js`

```javascript
import express from 'express';
import { protect } from '../middleware/auth.js';
import * as xxxController from '../controllers/xxxController.js';

const router = express.Router();

// 需要认证的路由
router.use(protect);

router.get('/', xxxController.getList);
router.post('/', xxxController.create);
router.get('/:id', xxxController.getById);
router.put('/:id', xxxController.update);
router.delete('/:id', xxxController.delete);

export default router;
```

### 步骤 2: 编写控制器
**文件**: `src/controllers/xxxController.js`

```javascript
export const create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description } = req.body;

    // 参数验证
    if (!title) {
      return Response.validationError(res, '标题不能为空');
    }

    // 创建记录
    const result = await Model.create({
      userId,
      title,
      description
    });

    Logger.success('创建成功', { id: result.id, userId });
    return Response.success(res, result, '创建成功', 201);
  } catch (error) {
    Logger.error('创建失败:', error);
    return Response.serverError(res, error.message);
  }
};
```

### 步骤 3: 注册路由
**文件**: `src/index.js`

```javascript
import xxxRoutes from './routes/xxxRoutes.js';

// 在其他路由下方添加
app.use('/api/xxx', xxxRoutes);
```

---

## ⚠️ 强制规范

### 安全规范
1. **用户数据隔离**: 所有查询必须加 `where: { userId }`
2. **密码处理**: 返回用户信息时必须排除密码字段
3. **环境变量**: 敏感信息使用 `process.env.XXX`，不要硬编码
4. **JWT Token**: 格式 `Authorization: Bearer <token>`

### 代码规范
1. **全局工具**: 使用 `Logger` 和 `Response`，无需 import
2. **模块系统**: 使用 ES6 `import/export`，文件名带 `.js` 扩展名
3. **异步处理**: 统一使用 `async/await`，避免回调
4. **错误处理**: Controller 层必须 `try-catch`

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | camelCase | `authController.js` |
| 类名 | PascalCase | `User`, `ImageStyle` |
| 函数/变量 | camelCase | `getUserById`, `isActive` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| 数据库表名 | snake_case | `users`, `image_styles` |
| 数据库字段 | snake_case | `user_id`, `created_at` |

### Import 顺序

```javascript
// 1. Node.js 内置模块
import path from 'path';

// 2. 第三方模块
import express from 'express';
import jwt from 'jsonwebtoken';

// 3. 项目模块
import User from '../models/User.js';
import someService from '../services/someService.js';

// 4. 全局工具（无需 import）
// Logger
// Response
```

---

## 📋 开发检查清单

开发新功能时，确保：

- [ ] 所有路由都添加了 `protect` 中间件
- [ ] 所有查询都加了 `userId` 条件隔离数据
- [ ] 使用 `Logger` 记录关键操作和错误
- [ ] 使用 `Response` 统一返回格式
- [ ] Controller 有完整的 try-catch 错误处理
- [ ] 参数验证在业务逻辑之前
- [ ] 数据库模型添加了必要的索引
- [ ] 敏感字段（如密码）不会返回给前端
- [ ] 代码遵循项目命名规范

---

## 📝 常用命令

```bash
# 启动开发服务器（热重载）
npm run dev

# 启动生产服务器
npm start
```

---

## 📚 相关文档

- [全局工具详细说明](./server/global-utils.md)
- [后端API完整文档](./server/api.md)

---

**提示**: 这是开发规范核心指南，专注于技术标准和代码规范
