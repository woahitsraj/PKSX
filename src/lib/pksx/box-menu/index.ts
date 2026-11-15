import type { BoxSourceType } from '$lib/pksx/storage-workbench';

export type BoxMenuCommandKey =
	| 'select'
	| 'export'
	| 'export-copy'
	| 'export-confirm'
	| 'export-cancel'
	| 'save-backup'
	| 'legality-report'
	| 'organize-storage-boxes'
	| 'undo-storage-organization'
	| 'switch'
	| 'open-another'
	| 'close';

export type BoxMenuCommand = {
	key: BoxMenuCommandKey;
	label: string;
	availability: 'available' | 'unavailable';
	reason: string | null;
};

export function createBoxMenuCommands(input: {
	source: { type: BoxSourceType; label: string };
	workspaceReady: boolean;
	paneCount: number;
	undoAvailable: boolean;
	linkedSource?: string;
	confirmExport?: boolean;
	selectionUnavailableReason: string | null;
}): BoxMenuCommand[] {
	const unavailable = (
		key: BoxMenuCommandKey,
		label: string,
		reason: string | null = null
	): BoxMenuCommand => ({
		key,
		label,
		availability: 'unavailable',
		reason
	});
	const available = (key: BoxMenuCommandKey, label: string): BoxMenuCommand => ({
		key,
		label,
		availability: 'available',
		reason: null
	});
	const workspaceReason = `${input.source.label} is still loading.`;
	const storage = input.source.type === 'pokemon-storage';
	const exportLabel = input.linkedSource && !storage ? 'Export to ' + input.linkedSource : 'Export';
	if (input.confirmExport)
		return [available('export-confirm', 'Overwrite'), available('export-cancel', 'Cancel')];
	const selectionReason =
		input.selectionUnavailableReason ??
		(!storage && !input.workspaceReady ? workspaceReason : null);

	return [
		...(storage ? [available('organize-storage-boxes', 'Organize Storage Boxes')] : []),
		storage
			? unavailable('export', 'Export', 'Pokemon Storage cannot be exported.')
			: input.workspaceReady
				? available('export', exportLabel)
				: unavailable('export', exportLabel, workspaceReason),
		...(input.linkedSource && !storage
			? [
					input.workspaceReady
						? available('export-copy', 'Export a copy')
						: unavailable('export-copy', 'Export a copy', workspaceReason)
				]
			: []),
		storage
			? unavailable('save-backup', 'Save a backup', 'Pokemon Storage does not use Backups.')
			: input.workspaceReady
				? available('save-backup', 'Save a backup')
				: unavailable('save-backup', 'Save a backup', workspaceReason),
		storage
			? unavailable('legality-report', 'Legality Report', 'Legality Reports need a Save File.')
			: input.workspaceReady
				? available('legality-report', 'Legality Report')
				: unavailable('legality-report', 'Legality Report', workspaceReason),
		available('switch', 'Switch'),
		input.paneCount >= 2
			? unavailable('open-another', 'Open another collection', 'Two collections are already open.')
			: available('open-another', 'Open another collection'),
		input.paneCount <= 1 ? unavailable('close', 'Close') : available('close', 'Close'),
		selectionReason
			? unavailable('select', 'Select Pokemon', selectionReason)
			: available('select', 'Select Pokemon'),
		...(storage
			? [
					input.undoAvailable
						? available('undo-storage-organization', 'Undo Storage organization')
						: unavailable(
								'undo-storage-organization',
								'Undo Storage organization',
								'No completed Storage organization change is available to undo.'
							)
				]
			: [])
	];
}
