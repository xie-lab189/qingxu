import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 53010, // 固化端口，使 `npm run dev` 与预览面板扫描对齐（避免默认抢 5173 造成错位）
    // 开发模式下把 /api 代理到本地后端（server/index.js，默认端口 3000）。
    // 只要后端进程在跑且注入了 ZHIPU_API_KEY，/api/chat 就不会 404，也不存在跨域。
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
