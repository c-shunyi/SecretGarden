const express = require("express");
const cors = require("cors");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const userRouter = require("./routes/user");
const billRouter = require("./routes/bill");
const fileRouter = require("./routes/file");
const checkinRouter = require("./routes/checkin");
const backupRouter = require("./routes/backup");
const { errorHandler } = require("./middlewares/error-handler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    name: "secret-garden-server",
    status: "ok",
    docs: [
      "GET /api/health",
      "POST /api/v1/auth/register",
      "POST /api/v1/auth/login",
      "POST /api/v1/auth/logout",
      "GET /api/v1/users/me",
      "PATCH /api/v1/users/me",
      "GET /api/v1/bills",
      "POST /api/v1/bills",
      "PATCH /api/v1/bills/:id",
      "DELETE /api/v1/bills/:id",
      "POST /api/v1/files/upload",
      "GET /api/v1/files",
      "GET /api/v1/files/:id/content",
      "DELETE /api/v1/files/:id",
      "GET /api/v1/backup/export",
      "POST /api/v1/backup/import",
      "POST /api/v1/checkin-plans",
      "GET /api/v1/checkin-plans",
      "GET /api/v1/checkin-plans/:id",
      "POST /api/v1/checkin-plans/join",
      "POST /api/v1/checkin-plans/:id/invite",
      "GET /api/v1/checkin-plans/:id/feed",
      "POST /api/v1/checkin-plans/:id/posts",
    ],
  });
});

app.use("/api/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/bills", billRouter);
app.use("/api/v1/files", fileRouter);
app.use("/api/v1/checkin-plans", checkinRouter);
app.use("/api/v1/backup", backupRouter);

app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: "路由不存在",
  });
});

app.use(errorHandler);

module.exports = app;
