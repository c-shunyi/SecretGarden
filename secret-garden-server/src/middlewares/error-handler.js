function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "服务器内部错误" : error.message;

  res.status(statusCode).json({
    code,
    message,
  });
}

module.exports = {
  errorHandler,
};
