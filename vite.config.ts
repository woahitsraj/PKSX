import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		{
			// The dev server serves JSON as JavaScript, which a `type: "json"` import refuses.
			name: 'esptool-js-dev-stubs',
			apply: 'serve',
			transform(code, id) {
				if (!id.includes('esptool-js/lib/stubFlasher')) return null;
				return code.replaceAll(', { with: { type: "json" } }', '');
			}
		}
	],
	assetsInclude: ['**/test-fixtures/save-files/**'],
	// Unoptimized, so the dev plugin above sees the flasher stub imports.
	optimizeDeps: {
		exclude: ['esptool-js'],
		include: ['esptool-js > pako', 'esptool-js > atob-lite']
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.browser.{test,spec}.{js,ts}']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: [
						'src/**/*.{test,spec}.{js,ts}',
						'scripts/**/*.{test,spec}.{js,ts}',
						'eslint-local-rules/**/*.{test,spec}.{js,ts}'
					],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.browser.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
