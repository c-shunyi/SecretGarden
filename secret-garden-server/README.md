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
FILE_STORAGE_ROOT=./storage
FILE_MAX_SIZE_MB=20
```

## File upload API

- `POST /api/v1/files/upload`
  - Content-Type: `multipart/form-data`
  - Field name: `file`
  - Auth: Bearer token required
- `GET /api/v1/files?limit=20`
- `GET /api/v1/files/:id/content`
- `DELETE /api/v1/files/:id`

Upload files are saved under:

- `${FILE_STORAGE_ROOT}/users/<userId>/...`

This means each user has an isolated file space based on their user id.

## Checkin plan API

- `POST /api/v1/checkin-plans`
  - body: `{ "name": "早起30天", "description": "可选说明" }`
- `GET /api/v1/checkin-plans`
- `GET /api/v1/checkin-plans/:id`
- `POST /api/v1/checkin-plans/join`
  - body: `{ "inviteCode": "AB12CD34" }`
- `POST /api/v1/checkin-plans/:id/invite`
  - only owner can regenerate invite code
- `GET /api/v1/checkin-plans/:id/feed?limit=20&beforeId=100`
  - newest first, like timeline feed
- `POST /api/v1/checkin-plans/:id/posts`
  - body: `{ "content": "今天完成了跑步", "imageFileIds": [11, 12] }`
  - supports text + up to 9 images
