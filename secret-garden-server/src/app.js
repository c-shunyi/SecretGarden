const express = require("express");
const cors = require("cors");
const healthRouter = require("./routes/health");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "secret-garden-server",
    status: "ok",
    docs: "Use /api/health to check server health."
  });
});

app.use("/api/health", healthRouter);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

module.exports = app;
