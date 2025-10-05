// frontend/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',   // Next.js backend
        changeOrigin: true,
        secure: false,                     // ถ้า dev backend เป็น HTTPS แบบ self-signed
        ws: true,                          // รองรับ WebSocket ถ้ามี (SSE ไม่ต้อง)
        // ถ้า frontend เส้นทางไม่ใช่ /api ตรง ๆ ค่อยใช้ rewrite:
        // rewrite: (path) => path.replace(/^\/api/, '/api'),
        // timeout เผื่อ request นาน ๆ (อัพโหลดไฟล์ ฯลฯ)
        proxyTimeout: 60_000
      }
    }
  },
  // ให้ vite preview ใช้ proxy ได้ด้วย (เวลาเทส build)
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});
