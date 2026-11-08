import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 真实后端（NestJS）：素材分类/素材列表 + uploads 静态资源
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      // cdn3.nicen.cn 有 Referer 防盗链（localhost 会 403），代理并伪装来源
      '/nicen': {
        target: 'https://cdn3.nicen.cn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nicen/, ''),
        headers: { referer: 'https://diy.nicen.cn/', origin: 'https://diy.nicen.cn' },
      },
    },
  },
});
