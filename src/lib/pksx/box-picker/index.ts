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
