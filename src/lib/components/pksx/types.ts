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
