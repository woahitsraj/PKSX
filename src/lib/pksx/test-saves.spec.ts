import { describe, expect, test } from 'vitest';
import { testSavesAllowed } from './test-saves';

describe('testSavesAllowed', () => {
	test('allows local, preview, and staging hosts only', () => {
		expect(testSavesAllowed('localhost')).toBe(true);
		expect(testSavesAllowed('pr-12-pksx-staging.example.workers.dev')).toBe(true);
		expect(testSavesAllowed('staging.pksx.app')).toBe(true);
		expect(testSavesAllowed('pksx.app')).toBe(false);
		expect(testSavesAllowed('evil-workers.dev.example.com')).toBe(false);
	});
});
