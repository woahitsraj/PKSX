export const VIRTUAL_POKEMON_ROW_HEIGHT = 200;

export function virtualRecordControlId(paneId: string, recordId: string): string {
	return `virtual-record-${paneId}-${recordId}`;
}
