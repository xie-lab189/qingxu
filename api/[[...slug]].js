// Vercel optional catch-all entry: mount the whole Express app as one Serverless Function.
// [[...slug]] matches both /api and /api/* so every /api/* route is handled by Express.
import app from "../server/index.js";

export default app;
