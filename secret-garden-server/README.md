# secret-garden-server

## Quick start

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: start with `nodemon`
- `npm start`: start with `node`

## API

- `GET /`: basic service info
- `GET /api/health`: health check
- `POST /api/v1/auth/register`: 注册
- `POST /api/v1/auth/login`: 登录
- `POST /api/v1/auth/logout`: 退出登录
- `GET /api/v1/users/me`: 获取个人资料
- `PATCH /api/v1/users/me`: 更新个人资料
- `GET /api/v1/relationship/status`: 绑定状态
- `POST /api/v1/relationship/invite`: 生成邀请码
- `POST /api/v1/relationship/bind`: 绑定伴侣
- `POST /api/v1/relationship/unbind`: 解绑伴侣

## Environment variables

Copy `.env.example` to `.env` and update values if needed:

```bash
PORT=3000
JWT_SECRET=please_change_me
ACCESS_TOKEN_EXPIRES_IN=7d
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=secret_garden
```
