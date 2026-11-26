import { defineConfig, devices } from '@playwright/test';
import { createServer, type AddressInfo } from 'node:net';
import { assertPkhexEngineCurrent } from './scripts/pkhex-engine-path.ts';

const prebuilt = process.env.PKSX_E2E_PREBUILT === '1';
assertPkhexEngineCurrent();

// Workers load this config again, so the first load stores the port for them.
process.env.PKSX_E2E_PORT ??= String(await freePort());
const port = Number(process.env.PKSX_E2E_PORT);

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer()
			.once('error', reject)
			.listen(0, '127.0.0.1', () => {
				const { port } = server.address() as AddressInfo;
				server.close(() => resolve(port));
			});
	});
}

export default defineConfig({
	webServer: {
		command: `${prebuilt ? '' : 'pnpm build && '}pnpm preview --host 127.0.0.1 --port ${port} --strictPort`,
		port
	},
	testMatch: '**/*.e2e.{ts,js}',
	// Engine-backed specs already declare 60s assertion budgets; the 30s default
	// test timeout capped them, so slow CI runs died mid-apply.
	timeout: 120_000,
	use: { baseURL: `http://127.0.0.1:${port}` },
	projects: [
		{
			name: 'chromium',
			grepInvert: /@mobile-touch/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'webkit-mobile-touch',
			grep: /@mobile-touch/,
			testMatch: '**/box-shell.e2e.ts',
			use: { ...devices['iPhone 13'] }
		},
		{
			name: 'webkit-responsive',
			grep: /@responsive-matrix/,
			testMatch: '**/responsive-contract.e2e.ts',
			use: { ...devices['Desktop Safari'] }
		}
	]
});
