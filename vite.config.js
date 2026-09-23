import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 前端(dev + 线上)都直连 Cloudflare Worker(带 CORS)，不再需要本地代理中间件。
// AI 生成 / 草稿存储都走 Worker，地址见 src/utils/api.js（VITE_API_BASE）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // GitHub Pages 项目站点路径：iceeeeli.github.io/<仓库名>/
    base: env.VITE_BASE || '/',
    plugins: [react()],
    define: { global: 'globalThis' },
  };
});
