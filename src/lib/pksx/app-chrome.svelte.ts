export const appChrome = $state({
	hasLoadedSave: false,
	carryActive: false,
	selectionActive: false,
	// What B does inside the open Takeover: null is Back, '' is unavailable.
	takeoverBack: null as string | null
});

export function updateAppChrome(input: Partial<typeof appChrome>) {
	Object.assign(appChrome, input);
}

export function publishTakeoverBack(label: string | null) {
	appChrome.takeoverBack = label;
	return () => {
		appChrome.takeoverBack = null;
	};
}
