// EdgeOne Pages Cloud Function（Node.js 框架模式）
// 直接复用青序的 Express 应用；平台会把 /api/* 的请求转发给这里导出的 app 实例。
// 文件位于 cloud-functions/api/[[default]].js，由 [[default]] 这一 catch-all 接管所有 /api/* 路由，
// 静态前端由 EdgeOne Pages 自动托管，无需本函数处理。
import app from "../../server/index.js";

export default app;
