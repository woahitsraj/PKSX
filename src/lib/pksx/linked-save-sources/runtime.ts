import { LinkedSaveSources, linkedSavesPlugin } from './index';
import {
	getCachedActiveWorkspace,
	getCachedActiveWorkspaceBox,
	getPkhexEngine,
	getSaveFileEditCoordinator,
	getSavesStorage
} from '$lib/pksx/saves-cache';

let sources: LinkedSaveSources | undefined;
export function getLinkedSaveSources() {
	return (sources ??= new LinkedSaveSources({
		storage: getSavesStorage(),
		engine: getPkhexEngine(),
		edits: getSaveFileEditCoordinator(),
		plugin: linkedSavesPlugin,
		boxForSave: (id) =>
			getCachedActiveWorkspace()?.file.id === id ? getCachedActiveWorkspaceBox() : 0
	}));
}
