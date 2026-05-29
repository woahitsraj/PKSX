import {
	createPkhexWorkerEngine,
	type EngineApi,
	type PartySlotSummary,
	type SaveSummary
} from '$lib/engine';
import { createCleanWorkspaceState, type WorkspaceState } from '$lib/pksx/backup-workflow';
import {
	IndexedDbLocalLibraryStorage,
	type BackupMetadata,
	type SaveFileId,
	type StoredSaveFile
} from '$lib/pksx/local-library';

export type SaveCardDetails = {
	summary: SaveSummary;
	partySlots: PartySlotSummary[];
	creatureCount: number;
};

export type SaveLibrarySnapshot = {
	activeSaveFileId: SaveFileId | null;
	saveFiles: StoredSaveFile[];
	backupsBySaveFileId: Record<SaveFileId, BackupMetadata[]>;
	detailsBySaveFileId: Record<SaveFileId, SaveCardDetails | null>;
};

type SaveDetailsCacheEntry = {
	fingerprint: string;
	details: SaveCardDetails | null;
};

const storage = new IndexedDbLocalLibraryStorage();
const detailsCache = new Map<SaveFileId, SaveDetailsCacheEntry>();

let engine: EngineApi | null = null;
let librarySnapshot: SaveLibrarySnapshot | null = null;
let activeWorkspace: WorkspaceState | null = null;
let activeWorkspaceBox = 0;

export function getLocalLibraryStorage() {
	return storage;
}

export function getPkhexEngine() {
	engine ??= createPkhexWorkerEngine('/pkhex-engine');
	return engine;
}

export function getCachedSaveLibrarySnapshot() {
	return librarySnapshot;
}

export async function getSaveLibrarySnapshot(options: { force?: boolean } = {}) {
	if (librarySnapshot && !options.force) {
		return librarySnapshot;
	}

	const [activeSaveFileId, saveFiles] = await Promise.all([
		storage.getActiveSaveFileId(),
		storage.listSaves()
	]);
	const backupEntries = await Promise.all(
		saveFiles.map(
			async (saveFile) => [saveFile.id, await storage.listBackups(saveFile.id)] as const
		)
	);
	const detailEntries = await Promise.all(
		saveFiles.map(async (saveFile) => [saveFile.id, await getSaveCardDetails(saveFile)] as const)
	);
	const activeIds = new Set(saveFiles.map((saveFile) => saveFile.id));

	for (const saveFileId of detailsCache.keys()) {
		if (!activeIds.has(saveFileId)) {
			detailsCache.delete(saveFileId);
		}
	}

	librarySnapshot = {
		activeSaveFileId,
		saveFiles,
		backupsBySaveFileId: Object.fromEntries(backupEntries),
		detailsBySaveFileId: Object.fromEntries(detailEntries)
	};

	return librarySnapshot;
}

export function invalidateSaveLibraryCache() {
	librarySnapshot = null;
}

export function getCachedActiveWorkspace() {
	return activeWorkspace;
}

export function getCachedActiveWorkspaceBox() {
	return activeWorkspaceBox;
}

export function setCachedActiveWorkspace(workspace: WorkspaceState | null, box = 0) {
	activeWorkspace = workspace;
	activeWorkspaceBox = box;
}

export function invalidateActiveWorkspaceCache(saveFileId?: SaveFileId) {
	if (!saveFileId || activeWorkspace?.file.id === saveFileId) {
		activeWorkspace = null;
		activeWorkspaceBox = 0;
	}
}

export async function loadActiveWorkspaceFromLibrary() {
	const activeSaveFileId = await storage.getActiveSaveFileId();
	const saveFile = activeSaveFileId ? await storage.getSave(activeSaveFileId) : null;
	const fallbackSaveFile = saveFile ?? (await storage.listSaves())[0] ?? null;

	if (!fallbackSaveFile) {
		return null;
	}

	if (activeWorkspace && activeWorkspace.file.id === fallbackSaveFile.id) {
		return activeWorkspace;
	}

	const bytes = await storage.getSaveBytes(fallbackSaveFile.id);
	if (!bytes) {
		return null;
	}

	const result = await getPkhexEngine().loadSaveWorkspace(
		bytes,
		fallbackSaveFile.originalFileName ?? undefined,
		0
	);
	if (!result.ok) {
		throw result.error;
	}

	activeWorkspace = createCleanWorkspaceState({
		file: fallbackSaveFile,
		bytes,
		workspace: result.value
	});
	activeWorkspaceBox = 0;
	return activeWorkspace;
}

async function getSaveCardDetails(saveFile: StoredSaveFile) {
	const fingerprint = createSaveFileFingerprint(saveFile);
	const cached = detailsCache.get(saveFile.id);

	if (cached?.fingerprint === fingerprint) {
		return cached.details;
	}

	const details = await loadSaveCardDetails(saveFile);
	detailsCache.set(saveFile.id, { fingerprint, details });
	return details;
}

async function loadSaveCardDetails(saveFile: StoredSaveFile): Promise<SaveCardDetails | null> {
	const bytes = await storage.getSaveBytes(saveFile.id);
	if (!bytes) {
		return null;
	}

	const activeEngine = getPkhexEngine();
	const workspace = await activeEngine.loadSaveWorkspace(
		bytes,
		saveFile.originalFileName ?? undefined,
		0
	);
	if (!workspace.ok) {
		return null;
	}

	let creatureCount = workspace.value.boxSlots.filter((slot) => !slot.isEmpty).length;
	for (let box = 1; box < workspace.value.summary.boxCount; box += 1) {
		const slots = await activeEngine.listBoxSlots(
			bytes,
			saveFile.originalFileName ?? undefined,
			box
		);
		if (slots.ok) {
			creatureCount += slots.value.filter((slot) => !slot.isEmpty).length;
		}
	}

	return {
		summary: workspace.value.summary,
		partySlots: workspace.value.partySlots,
		creatureCount
	};
}

function createSaveFileFingerprint(saveFile: StoredSaveFile) {
	return `${saveFile.importedAt}:${saveFile.byteLength}:${saveFile.originalFileName ?? ''}`;
}
