import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	// Engine-backed specs already declare 60s assertion budgets; the 30s default
	// test timeout capped them, so slow CI runs died mid-apply.
	timeout: 120_000
});
