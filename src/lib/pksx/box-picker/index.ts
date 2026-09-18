import type { NavigationAction } from '$lib/pksx/box-navigation';
import type { SaveFileBoxNameProjection } from '$lib/engine';

export type BoxPickerLocationRef =
	| { kind: 'physical-box'; box: number }
	| { kind: 'virtual'; id: string };

export type BoxPickerLocation = {
	id: string;
	label: string;
	detail: string;
	location: BoxPickerLocationRef;
};

export type BoxPickerControllerFocus = {
	zone: 'locations' | 'rename-command' | 'rename-form' | 'reorder-command' | 'reorder-targets';
	locationIndex: number;
	formIndex: number;
};

export function boxIndexAfterMove(index: number, box: number, destination: number): number {
	if (index === box) return destination;
	if (box < destination && index > box && index <= destination) return index - 1;
	if (box > destination && index >= destination && index < box) return index + 1;
	return index;
}

export function boxNameFor(box: number, boxNames?: SaveFileBoxNameProjection | null): string {
	const name = boxNames?.supported ? boxNames.names[box]?.trim() : undefined;
	return name || `Box ${String(box + 1).padStart(2, '0')}`;
}

export function createPhysicalBoxPickerLocations(
	boxCount: number,
	boxNames?: SaveFileBoxNameProjection | null
): BoxPickerLocation[] {
	const count = Math.max(0, Math.trunc(boxCount));
	return Array.from({ length: count }, (_, box) => ({
		id: `physical-box-${box}`,
		label: boxNameFor(box, boxNames),
		detail: `${box + 1} of ${count}`,
		location: { kind: 'physical-box', box }
	}));
}

export function moveBoxPickerFocus(
	index: number,
	action: Extract<NavigationAction, 'left' | 'right' | 'up' | 'down'>,
	locationCount: number,
	columnCount = 1
): number {
	const count = Math.max(1, locationCount);
	const columns = Math.max(1, Math.min(Math.trunc(columnCount), count));
	const row = Math.floor(index / columns);
	const column = index % columns;
	const rowStart = row * columns;
	const rowLength = Math.min(columns, count - rowStart);

	if (action === 'left' || action === 'right') {
		const offset = action === 'left' ? -1 : 1;
		return rowStart + ((column + offset + rowLength) % rowLength);
	}

	const rowCount = Math.ceil(count / columns);
	const offset = action === 'up' ? -1 : 1;
	const targetRow = (row + offset + rowCount) % rowCount;
	return targetRow * columns + Math.min(column, count - targetRow * columns - 1);
}

export function moveBoxPickerControllerFocus(
	focus: BoxPickerControllerFocus,
	action: Extract<NavigationAction, 'left' | 'right' | 'up' | 'down'>,
	locationCount: number,
	columnCount: number,
	renameAvailable: boolean,
	reorderAvailable = false
): BoxPickerControllerFocus {
	if (focus.zone === 'rename-form') {
		const offset = action === 'left' || action === 'up' ? -1 : 1;
		return { ...focus, formIndex: (focus.formIndex + offset + 3) % 3 };
	}
	if (focus.zone === 'rename-command' || focus.zone === 'reorder-command') {
		if (action === 'down') return { ...focus, zone: 'locations' };
		if ((action === 'left' || action === 'right') && renameAvailable && reorderAvailable) {
			return {
				...focus,
				zone: focus.zone === 'rename-command' ? 'reorder-command' : 'rename-command'
			};
		}
		return focus;
	}
	if (focus.zone === 'locations' && action === 'up' && focus.locationIndex < columnCount) {
		if (renameAvailable) return { ...focus, zone: 'rename-command' };
		if (reorderAvailable) return { ...focus, zone: 'reorder-command' };
	}
	return {
		...focus,
		locationIndex: moveBoxPickerFocus(focus.locationIndex, action, locationCount, columnCount)
	};
}
