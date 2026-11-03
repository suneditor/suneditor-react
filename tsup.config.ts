import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	sourcemap: true,
	clean: true,
	external: ['react', 'suneditor'],
	// Next.js App Router: the component uses hooks, so it must be a client module.
	banner: { js: '"use client";' },
});
