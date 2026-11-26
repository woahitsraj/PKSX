import type { Destination } from '$lib/pksx/destination-focus';
import type { SummonedWorkflowKind } from '$lib/pksx/summoned-workflow';

export type ControllerGuideHint = { button: string; action: string };

export type ControllerGuideContext = {
	destination: Destination;
	workflow: SummonedWorkflowKind | null;
	carry: boolean;
	selection: boolean;
};

const confirmations = new Set<SummonedWorkflowKind>([
	'clear-slot-confirmation',
	'recently-deleted-confirmation',
	'save-file-delete',
	'storage-backup-confirmation'
]);

const menus = new Set<SummonedWorkflowKind>([
	'slot-menu',
	'virtual-record-menu',
	'recently-deleted-menu',
	'box-menu',
	'save-file-menu',
	'storage-backup-menu',
	'add-saves-menu',
	'selection-actions'
]);

const move = { button: 'D-pad', action: 'Move' };

export function controllerGuideHints(context: ControllerGuideContext): ControllerGuideHint[] {
	const { workflow } = context;
	if (workflow === 'main-menu')
		return [move, { button: 'A', action: 'Open' }, { button: 'B', action: 'Close' }];
	if (workflow === 'quick-search')
		return [move, { button: 'A', action: 'Go to Pokemon' }, { button: 'B', action: 'Close' }];
	if (workflow === 'pokemon-editor')
		return [
			move,
			{ button: 'A', action: 'Select' },
			{ button: 'L2 / R2', action: 'Section' },
			{ button: 'B', action: 'Back' }
		];
	if (workflow && confirmations.has(workflow))
		return [move, { button: 'A', action: 'Confirm' }, { button: 'B', action: 'Cancel' }];
	if (workflow && menus.has(workflow))
		return [move, { button: 'A', action: 'Select' }, { button: 'B', action: 'Close' }];
	if (workflow) return [move, { button: 'A', action: 'Select' }, { button: 'B', action: 'Back' }];

	if (context.carry)
		return [
			move,
			{ button: 'A', action: 'Place' },
			{ button: 'Y', action: 'Move / Copy' },
			{ button: 'L1 / R1', action: 'Box' },
			{ button: 'B', action: 'Cancel' }
		];

	if (context.destination === 'boxes' && context.selection)
		return [
			{ button: 'D-pad', action: 'Extend range' },
			{ button: 'A', action: 'Toggle' },
			{ button: 'Y', action: 'Actions' },
			{ button: 'L1 / R1', action: 'Box' },
			{ button: 'B', action: 'Exit Select' }
		];

	const shared = [
		{ button: 'Y', action: 'Search' },
		{ button: 'Start', action: 'Menu' }
	];
	if (context.destination === 'boxes')
		return [
			move,
			{ button: 'A', action: 'Slot Menu' },
			{ button: 'X', action: 'Box Menu' },
			{ button: 'Select', action: 'Select' },
			{ button: 'L1 / R1', action: 'Box' },
			...shared
		];
	if (context.destination === 'saves')
		return [move, { button: 'A', action: 'Open' }, { button: 'X', action: 'Options' }, ...shared];
	return [move, { button: 'A', action: 'Select' }, { button: 'B', action: 'Boxes' }, ...shared];
}
