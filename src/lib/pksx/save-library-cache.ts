import {
	createPkhexWorkerEngine,
	type EngineApi,
	type PartySlotSummary,
	type SaveSummary
} from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import {
	createLocalLibraryStorage,
	type BackupMetadata,
	type SaveFileId,
	type StoredSaveFile
} from '$lib/pksx/local-library';
import {
	ActiveWorkspaceService,
	LocalStorageWorkspacePersistence
} from '$lib/pksx/workspace-store';

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

const storage = createLocalLibraryStorage();
const detailsCache = new Map<SaveFileId, SaveDetailsCacheEntry>();

let engine: EngineApi | null = null;
let librarySnapshot: SaveLibrarySnapshot | null = null;
let librarySnapshotSeeded = false;
let workspaceService: ActiveWorkspaceService | null = null;
let workspaceServiceStart: Promise<void> | null = null;
let activeWorkspaceBox = 0;

export function getLocalLibraryStorage() {
	return storage;
}

export function getPkhexEngine() {
	engine ??= createPkhexWorkerEngine('/pkhex-engine');
	return engine;
}

export function getActiveWorkspaceService() {
	workspaceService ??= new ActiveWorkspaceService({
		storage,
		engine: getPkhexEngine,
		persistence:
			typeof localStorage === 'undefined'
				? undefined
				: new LocalStorageWorkspacePersistence('pksx-active-workspace-v1')
	});
	return workspaceService;
}

async function startActiveWorkspaceService() {
	const service = getActiveWorkspaceService();
	workspaceServiceStart ??= service.start();
	await workspaceServiceStart;
	return service;
}

export function getCachedSaveLibrarySnapshot() {
	return librarySnapshot;
}

export function isCachedSaveLibrarySnapshotSeeded() {
	return librarySnapshot !== null && librarySnapshotSeeded;
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
	librarySnapshotSeeded = false;

	return librarySnapshot;
}

export function invalidateSaveLibraryCache() {
	librarySnapshot = null;
	librarySnapshotSeeded = false;
}

export function getCachedActiveWorkspace() {
	return workspaceService?.current ?? null;
}

export function getCachedActiveWorkspaceBox() {
	return activeWorkspaceBox;
}

export function setCachedActiveWorkspace(workspace: WorkspaceState | null, box = 0) {
	getActiveWorkspaceService().set(workspace, box);
	activeWorkspaceBox = box;
	if (workspace) {
		detailsCache.set(workspace.file.id, {
			fingerprint: createSaveFileFingerprint(workspace.file),
			details: createSaveCardDetailsFromWorkspace(workspace)
		});
	}
	if (workspace && librarySnapshot) {
		librarySnapshot = mergeWorkspaceIntoSnapshot(librarySnapshot, workspace);
	}
}

export function invalidateActiveWorkspaceCache(saveFileId?: SaveFileId) {
	if (!saveFileId || workspaceService?.current?.file.id === saveFileId) {
		workspaceService?.set(null);
		activeWorkspaceBox = 0;
	}
}

export function seedSaveLibrarySnapshotFromActiveWorkspace(
	saveFiles: StoredSaveFile[],
	options: { backupsBySaveFileId?: Record<SaveFileId, BackupMetadata[]> } = {}
) {
	const workspace = workspaceService?.current ?? null;
	if (!workspace) {
		return null;
	}

	const details =
		detailsCache.get(workspace.file.id)?.details ?? createSaveCardDetailsFromWorkspace(workspace);
	const nextSaveFiles = ensureSaveFileIncluded(saveFiles, workspace.file);
	const snapshot: SaveLibrarySnapshot = {
		activeSaveFileId: workspace.file.id,
		saveFiles: nextSaveFiles,
		backupsBySaveFileId: Object.fromEntries(
			nextSaveFiles.map((saveFile) => [
				saveFile.id,
				options.backupsBySaveFileId?.[saveFile.id] ?? []
			])
		),
		detailsBySaveFileId: Object.fromEntries(
			nextSaveFiles.map((saveFile) => [
				saveFile.id,
				saveFile.id === workspace.file.id
					? details
					: (detailsCache.get(saveFile.id)?.details ?? null)
			])
		)
	};

	librarySnapshot = snapshot;
	librarySnapshotSeeded = true;
	detailsCache.set(workspace.file.id, {
		fingerprint: createSaveFileFingerprint(workspace.file),
		details
	});
	return snapshot;
}

export async function loadActiveWorkspaceFromLibrary() {
	const activeSaveFileId = await storage.getActiveSaveFileId();
	const saveFile = activeSaveFileId ? await storage.getSave(activeSaveFileId) : null;
	const fallbackSaveFile = saveFile ?? (await storage.listSaves())[0] ?? null;

	if (!fallbackSaveFile) {
		return null;
	}

	const service = await startActiveWorkspaceService();
	const activeWorkspace = service.current;
	if (activeWorkspace && activeWorkspace.file.id === fallbackSaveFile.id) {
		return activeWorkspace;
	}

	const workspace = await service.hydrate(fallbackSaveFile.id, 0);
	activeWorkspaceBox = 0;
	return workspace;
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

function createSaveCardDetailsFromWorkspace(workspace: WorkspaceState): SaveCardDetails {
	return {
		summary: workspace.workspace.summary,
		partySlots: workspace.workspace.partySlots,
		creatureCount: workspace.workspace.boxSlots.filter((slot) => !slot.isEmpty).length
	};
}

function mergeWorkspaceIntoSnapshot(
	snapshot: SaveLibrarySnapshot,
	workspace: WorkspaceState
): SaveLibrarySnapshot {
	const saveFiles = ensureSaveFileIncluded(snapshot.saveFiles, workspace.file);

	return {
		activeSaveFileId: workspace.file.id,
		saveFiles,
		backupsBySaveFileId: {
			...Object.fromEntries(saveFiles.map((saveFile) => [saveFile.id, []])),
			...snapshot.backupsBySaveFileId
		},
		detailsBySaveFileId: {
			...Object.fromEntries(saveFiles.map((saveFile) => [saveFile.id, null])),
			...snapshot.detailsBySaveFileId,
			[workspace.file.id]: createSaveCardDetailsFromWorkspace(workspace)
		}
	};
}

function ensureSaveFileIncluded(saveFiles: StoredSaveFile[], saveFile: StoredSaveFile) {
	const existing = saveFiles.some((candidate) => candidate.id === saveFile.id);
	return existing ? saveFiles : [saveFile, ...saveFiles];
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
