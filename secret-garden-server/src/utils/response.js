const Response = {
  success(res, data = null, msg = '成功', status = 200) {
    return res.status(status).json({
      code: 0,
      data,
      msg
    });
  },
  validationError(res, msg = '参数错误') {
    return Response._error(res, 400, msg);
  },
  unauthorized(res, msg = '未授权') {
    return Response._error(res, 401, msg);
  },
  notFound(res, msg = '资源不存在') {
    return Response._error(res, 404, msg);
  },
  serverError(res, msg = '服务器错误') {
    return Response._error(res, 500, msg);
  },
  paginate(res, list, total, page, limit, msg = '成功') {
    return Response.success(res, { list, total, page, limit }, msg);
  },
  _error(res, status, msg) {
    return res.status(status).json({
      code: status,
      data: null,
      msg
    });
  }
};

export default Response;
