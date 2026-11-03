import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Manual playground: `npm run dev`. Imports the component straight from `src/`.
export default defineConfig({
	root: 'playground',
	plugins: [react()],
	resolve: { alias: { '@suneditor/suneditor-react': fileURLToPath(new URL('./src/index.ts', import.meta.url)) } },
	server: { open: true },
});
