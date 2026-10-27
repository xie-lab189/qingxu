// Vercel 云函数入口：把青序的 Express 应用整体作为 Serverless Function 暴露。
// 所有 /api/* 路由由这一个函数处理；静态资源（dist/）由 Vercel 直接托管，无需此函数参与。
// 注意：server/index.js 内部已用 process.env.VERCEL 区分——在 Vercel 上不会执行 app.listen / 静态托管。
import app from "../server/index.js";

export default app;
