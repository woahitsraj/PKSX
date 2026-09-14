import type { ControllerKey } from '$lib/pksx/controller-input';

type AppCommandDefinition = {
	id: string;
	action: string;
	controller: string;
	keyboard: string;
	controllerKey: ControllerKey;
	keyboardKey: string;
	shiftKey: boolean;
};

export const appCommands = [
	{
		id: 'main-menu',
		action: 'Main Menu',
		controller: 'Start',
		keyboard: 'Cmd/Ctrl+Shift+K',
		controllerKey: 'Menu',
		keyboardKey: 'k',
		shiftKey: true
	},
	{
		id: 'search',
		action: 'Search',
		controller: 'Y',
		keyboard: 'Cmd/Ctrl+K',
		controllerKey: 'y',
		keyboardKey: 'k',
		shiftKey: false
	}
] as const satisfies readonly AppCommandDefinition[];

export type AppCommandId = (typeof appCommands)[number]['id'];

export function appCommandForEvent(
	event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
	fromController: boolean
): AppCommandId | null {
	if (fromController) {
		return (
			appCommands.find((command) => command.controllerKey.toLowerCase() === event.key.toLowerCase())
				?.id ?? null
		);
	}

	if ((!event.metaKey && !event.ctrlKey) || event.altKey) return null;
	return (
		appCommands.find(
			(command) =>
				command.keyboardKey === event.key.toLowerCase() && command.shiftKey === event.shiftKey
		)?.id ?? null
	);
}
