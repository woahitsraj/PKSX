import type { SlotView } from '$lib/components/pksx/types';

export type SlotMenuCommandKey =
	| 'pokemon-action'
	| 'evolve'
	| 'create-pokemon'
	| 'move'
	| 'copy'
	| 'store-automatically'
	| 'clear'
	| 'export'
	| 'legality-check';

export type SlotMenuCommand = {
	key: SlotMenuCommandKey;
	label: string;
	availability: 'available' | 'unsupported' | 'empty-slot' | 'occupied-slot';
	reason: string | null;
};

export function createSlotMenuCommands(
	slot: SlotView,
	createPokemonReason: string | null,
	capabilities: { edit: boolean; legality: boolean; evolve: boolean; storage?: boolean }
): SlotMenuCommand[] {
	if (slot.kind === 'empty') {
		return createPokemonReason
			? []
			: [
					{
						key: 'create-pokemon',
						label: 'Create Pokemon',
						availability: 'available',
						reason: null
					}
				];
	}

	return [
		...(capabilities.edit
			? ([
					{ key: 'pokemon-action', label: 'Edit', availability: 'available', reason: null }
				] as const)
			: []),
		{ key: 'move', label: 'Move', availability: 'available', reason: null },
		{ key: 'copy', label: 'Copy', availability: 'available', reason: null },
		...(capabilities.storage
			? ([
					{
						key: 'store-automatically',
						label: 'Store Automatically',
						availability: 'available',
						reason: null
					}
				] as const)
			: []),
		{ key: 'clear', label: 'Clear Slot', availability: 'available', reason: null },
		...(capabilities.legality
			? ([
					{
						key: 'legality-check',
						label: 'Legality Check',
						availability: 'available',
						reason: null
					}
				] as const)
			: []),
		...(capabilities.evolve
			? ([{ key: 'evolve', label: 'Evolve', availability: 'available', reason: null }] as const)
			: [])
	];
}
