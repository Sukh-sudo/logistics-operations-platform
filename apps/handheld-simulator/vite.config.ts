import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Keeping the browser on one origin avoids a simulator-only CORS exception.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
