import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: true
  },
  optimizeDeps: {
    include: ['pdf-lib', 'jspdf', 'html2canvas', 'xlsx', 'docx', 'pptxgenjs', 'jszip', 'canvas-confetti', 'lucide']
  }
});
