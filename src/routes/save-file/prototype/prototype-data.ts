// Throwaway: loads the committed Emerald fixture through the real engine for the Save File prototype (#169).
import type { EngineApi, InventoryItemOption, SaveFileEditableProjection } from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import {
	getPkhexEngine,
	getSavesStorage,
	invalidateActiveWorkspaceCache,
	invalidateSavesCache,
	loadActiveWorkspaceFromSaves
} from '$lib/pksx/saves-cache';
import emeraldUrl from '../../../../test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav?url';

export type Catalogue = Record<string, InventoryItemOption[]>;

export async function loadPrototypeWorkspace(): Promise<WorkspaceState> {
	let workspace = await loadActiveWorkspaceFromSaves();
	if (!workspace) {
		const bytes = new Uint8Array(await (await fetch(emeraldUrl)).arrayBuffer());
		const engine: EngineApi = getPkhexEngine();
		const loaded = await engine.loadSaveWorkspace(bytes, 'emerald-011020251345.sav', 0);
		if (!loaded.ok) throw loaded.error;
		await getSavesStorage().importSave({ bytes, originalFileName: 'emerald-011020251345.sav' });
		invalidateSavesCache();
		invalidateActiveWorkspaceCache();
		workspace = await loadActiveWorkspaceFromSaves();
	}
	if (!workspace?.workspace.saveFile)
		throw new Error('The engine returned no Save File projection.');
	return workspace;
}

export async function loadCatalogue(workspace: WorkspaceState): Promise<Catalogue> {
	const result = await getPkhexEngine().getSaveFileInventoryCatalogue(
		workspace.bytes,
		workspace.file.originalFileName ?? undefined
	);
	if (!result.ok) throw result.error;
	return Object.fromEntries(result.value.pockets.map((p) => [p.key, p.availableItems]));
}

// Stress data: real engine limits and real catalogue names. Only the trainer name is synthetic (W to max length).
export function stressProjection(
	projection: SaveFileEditableProjection,
	catalogue: Catalogue
): SaveFileEditableProjection {
	const profile = projection.trainerProfile;
	return {
		trainerProfile: {
			...profile,
			trainerName: profile.trainerNameSupported
				? 'W'.repeat(profile.trainerNameMaxLength)
				: profile.trainerName
		},
		money: { ...projection.money, value: projection.money.supported ? projection.money.max : null },
		inventory: {
			...projection.inventory,
			pockets: projection.inventory.pockets.map((pocket) => {
				const have = new Set(pocket.items.map((item) => item.id));
				const longest = (catalogue[pocket.key] ?? [])
					.filter((item) => !have.has(item.id))
					.sort((a, b) => b.name.length - a.name.length);
				const fill = longest
					.slice(0, Math.max(0, pocket.capacity - pocket.items.length))
					.map((item) => ({ ...item, quantity: item.maxQuantity }));
				const items = [...fill.slice(0, 3), ...pocket.items, ...fill.slice(3)];
				return { ...pocket, items, full: items.length >= pocket.capacity };
			})
		}
	};
}

export type OmitKey = 'trainer' | 'money' | 'inventory';

// Engine literal reasons from EngineContracts.cs; #168 omits the field, so they never render on the route.
export function omitCapabilities(
	projection: SaveFileEditableProjection,
	omit: Set<OmitKey>
): SaveFileEditableProjection {
	return {
		trainerProfile: omit.has('trainer')
			? {
					...projection.trainerProfile,
					trainerNameSupported: false,
					trainerNameUnsupportedReason:
						'Trainer name editing is not supported for this Save File format.',
					genderSupported: false,
					genderUnsupportedReason:
						'Trainer gender editing is not supported for this Save File format.'
				}
			: projection.trainerProfile,
		money: omit.has('money')
			? {
					...projection.money,
					supported: false,
					value: null,
					unsupportedReason: 'Money editing is not supported for this Save File format.'
				}
			: projection.money,
		inventory: omit.has('inventory')
			? {
					supported: false,
					unsupportedReason: 'Inventory editing is not supported for this Save File format.',
					pockets: []
				}
			: projection.inventory
	};
}

export function formatMoney(value: number) {
	return value.toLocaleString('en-US');
}
