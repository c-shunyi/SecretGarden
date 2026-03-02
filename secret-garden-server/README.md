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
- `POST /api/v1/auth/register`: register
- `POST /api/v1/auth/login`: login
- `POST /api/v1/auth/logout`: logout
- `GET /api/v1/users/me`: get my profile
- `PATCH /api/v1/users/me`: update my profile
- `GET /api/v1/bills`: list bills
- `POST /api/v1/bills`: create bill
- `PATCH /api/v1/bills/:id`: update bill
- `DELETE /api/v1/bills/:id`: delete bill
- `POST /api/v1/files/upload`: upload file
- `GET /api/v1/files`: list files
- `GET /api/v1/files/:id/content`: get file content
- `DELETE /api/v1/files/:id`: delete file
- `POST /api/v1/checkin-plans`: create checkin plan
- `GET /api/v1/checkin-plans`: list checkin plans
- `GET /api/v1/checkin-plans/:id`: checkin plan detail
- `POST /api/v1/checkin-plans/join`: join checkin plan by invite code
- `POST /api/v1/checkin-plans/:id/invite`: regenerate checkin invite code
- `GET /api/v1/checkin-plans/:id/feed`: checkin feed
- `POST /api/v1/checkin-plans/:id/posts`: create checkin post

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
  - body: `{ "name": "Morning 30 days", "description": "optional" }`
- `GET /api/v1/checkin-plans`
- `GET /api/v1/checkin-plans/:id`
- `POST /api/v1/checkin-plans/join`
  - body: `{ "inviteCode": "AB12CD34" }`
- `POST /api/v1/checkin-plans/:id/invite`
  - only owner can regenerate invite code
- `GET /api/v1/checkin-plans/:id/feed?limit=20&beforeId=100`
  - newest first, like timeline feed
- `POST /api/v1/checkin-plans/:id/posts`
  - body: `{ "content": "finished running", "imageFileIds": [11, 12] }`
  - supports text + up to 9 images
