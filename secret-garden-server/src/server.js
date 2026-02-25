require("dotenv").config();
const app = require("./app");
const { initDatabase } = require("./db/mysql");

const port = Number(process.env.PORT) || 3000;

async function bootstrap() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`服务已启动: http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("服务启动失败:", error.message);
  process.exit(1);
});
