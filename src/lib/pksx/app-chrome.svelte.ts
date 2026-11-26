export const appChrome = $state({
	hasLoadedSave: false,
	carryActive: false,
	selectionActive: false
});

export function updateAppChrome(input: Partial<typeof appChrome>) {
	Object.assign(appChrome, input);
}
