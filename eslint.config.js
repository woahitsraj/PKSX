import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';
import pksx from './eslint-local-rules/design-contract.js';
import pksxE2e from './eslint-local-rules/e2e-page-load.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		plugins: { pksx },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'pksx/no-owned-token-writes': 'error',
			'pksx/no-responsive-classifier': 'error',
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$lib/pksx/saves-cache',
							importNames: ['invalidateSavesCache'],
							message: 'Saves storage writes refresh the Saves list. Do not reload it by hand.'
						}
					]
				}
			]
		}
	},
	{
		files: ['**/*.{test,spec,e2e}.{js,ts}', 'tests/**/*.{js,ts}'],
		rules: { 'pksx/no-responsive-classifier': 'off', 'no-restricted-imports': 'off' }
	},
	{
		files: ['**/*.e2e.ts', '**/*.e2e-helper.ts'],
		ignores: ['src/routes/route-load.e2e-helper.ts'],
		plugins: { 'pksx-e2e': pksxE2e },
		rules: { 'pksx-e2e/no-raw-page-load': 'error' }
	},
	{
		// Known exceptions. A stale entry fails, so this list only gets shorter.
		files: ['src/routes/pokemon-storage-migration.e2e.ts'],
		rules: {
			'pksx-e2e/no-raw-page-load': ['error', { exceptions: ['/__storage-migration-fixture'] }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
