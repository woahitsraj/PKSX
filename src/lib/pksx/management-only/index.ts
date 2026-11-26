import type { SaveFileEditOperation } from '$lib/engine';

const storageKey = 'pksx-management-only';

export type ManagementOnlyBlockedAction =
	| 'edit-pokemon'
	| 'legality-fix'
	| 'evolve'
	| 'create-pokemon'
	| 'copy-pokemon'
	| 'link-trade'
	| 'edit-save-data';

const blockedLabels: Record<ManagementOnlyBlockedAction, string> = {
	'edit-pokemon': 'Pokemon edits',
	'legality-fix': 'Legality Fixes',
	evolve: 'Evolution',
	'create-pokemon': 'Pokemon creation',
	'copy-pokemon': 'Copy and Duplicate',
	'link-trade': 'Link Trades',
	'edit-save-data': 'trainer, bag, and Pokedex edits'
};

export const managementOnlyRestoreNote =
	'Management only stays on. A restored Backup can bring back earlier Pokemon, and PKSX does not certify that a Save File meets the rules of an external achievement system.';

export class ManagementOnlyError extends Error {
	readonly code = 'management-only';
	constructor(readonly action: ManagementOnlyBlockedAction) {
		super(blockedMessage(action));
	}
}

function blockedMessage(action: ManagementOnlyBlockedAction) {
	return `Management only blocks ${blockedLabels[action]}. Turn it off in Settings to allow this.`;
}

/** Reads the stored value on each call, so a surface opened earlier cannot keep an old answer. */
export function isManagementOnly(): boolean {
	try {
		return localStorage.getItem(storageKey) === 'on';
	} catch {
		return false;
	}
}

export function setManagementOnly(enabled: boolean) {
	if (enabled) localStorage.setItem(storageKey, 'on');
	else localStorage.removeItem(storageKey);
}

export function managementOnlyBlock(action: ManagementOnlyBlockedAction): string | null {
	return isManagementOnly() ? blockedMessage(action) : null;
}

export function assertManagementAllows(action: ManagementOnlyBlockedAction) {
	if (isManagementOnly()) throw new ManagementOnlyError(action);
}

/** Box names and Box order are organization. Every other Save File edit changes save data. */
export function saveFileEditBlock(operation: SaveFileEditOperation): string | null {
	return operation.pokedex ||
		operation.trainerProfile ||
		operation.money !== undefined ||
		operation.inventory
		? managementOnlyBlock('edit-save-data')
		: null;
}
