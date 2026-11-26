import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertManagementAllows, ManagementOnlyError, saveFileEditBlock } from './index';

function enable() {
	vi.stubGlobal('localStorage', { getItem: () => 'on' });
}

afterEach(() => vi.unstubAllGlobals());

describe('Management only', () => {
	it('allows every action while the Preference is off', () => {
		expect(() => assertManagementAllows('edit-pokemon')).not.toThrow();
		expect(saveFileEditBlock({ money: 1 })).toBeNull();
	});

	it('blocks save data edits and keeps Box organization', () => {
		enable();
		expect(() => assertManagementAllows('copy-pokemon')).toThrow(ManagementOnlyError);
		for (const operation of [
			{ money: 0 },
			{ trainerProfile: { trainerName: 'CASS' } },
			{ inventory: [] },
			{ boxName: { box: 0, name: 'A' }, money: 1 }
		])
			expect(saveFileEditBlock(operation)).toContain('Management only blocks');
		expect(saveFileEditBlock({ boxName: { box: 0, name: 'A' } })).toBeNull();
		expect(saveFileEditBlock({ boxMove: { box: 0, destination: 1 } })).toBeNull();
	});
});
