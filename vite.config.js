import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  server: {
    host: '0.0.0.0', // This allows connections from any network interface
    allowedHosts: [
      'a799-240e-6b0-3001-87-984a-dfa7-deb-f9ce.ngrok-free.app'
    ],
    proxy: {
      // 关键配置部分
      '/api': {
        // 这里填写你本地后端API的地址
        target: 'http://localhost:7001',

        // changeOrigin: true 会修改请求头中的 Origin 字段，
        // 通常在跨域请求时需要，以防止后端服务器的源校验
        changeOrigin: true,

        // rewrite 会重写请求路径。这行代码是精髓！
        // 它会把请求路径中的 /api 去掉，再转发给后端
        // 例如，请求 /api/users 会被转发为 /users
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
