export type SlotView = {
	slot: number;
	label: string;
	detail: string;
	level: number | null;
	speciesId: number | null;
	kind: 'pokemon' | 'empty';
};

export type MobileTab = {
	key: string;
	label: string;
	glyph: string;
};

export type BoxNavItem = {
	index: number;
	name: string;
	hue: number;
	active: boolean;
	occupied: number | null;
};

export type BoxSourceView = {
	key: 'save-file' | 'pokemon-storage';
	label: string;
	activeBoxLabel: string;
	activeBoxNumber: number;
	boxCount: number;
	occupied: number;
	capacity: number;
};
