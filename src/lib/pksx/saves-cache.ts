import {
	createPkhexWorkerEngine,
	type BoxSlotSummary,
	type EngineApi,
	type EngineResult,
	type PartySlotSummary,
	type SaveSummary
} from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import { createSavesStorage, type SaveFileId, type StoredSaveFile } from '$lib/pksx/saves';
import {
	ActiveWorkspaceService,
	LocalStorageWorkspacePersistence
} from '$lib/pksx/workspace-store';

export type SaveCardDetails = {
	summary: SaveSummary;
	partySlots: PartySlotSummary[];
	creatureCount: number;
};

export type SaveCardDetailsState =
	| { status: 'loading' }
	| { status: 'ready'; details: SaveCardDetails }
	| { status: 'unavailable' };

export type SavesSnapshot = {
	activeSaveFileId: SaveFileId | null;
	saveFiles: StoredSaveFile[];
	detailsBySaveFileId: Record<SaveFileId, SaveCardDetailsState>;
};

type SaveDetailsCacheEntry = {
	fingerprint: string;
	state: Exclude<SaveCardDetailsState, { status: 'loading' }>;
};

type SavesSnapshotOptions = {
	force?: boolean;
	onUpdate?: (snapshot: SavesSnapshot) => void;
};

const storage = createSavesStorage();
const detailsCache = new Map<SaveFileId, SaveDetailsCacheEntry>();

let engine: EngineApi | null = null;
let savesSnapshot: SavesSnapshot | null = null;
let savesSnapshotSeeded = false;
let snapshotGeneration = 0;
let workspaceService: ActiveWorkspaceService | null = null;
let workspaceServiceStart: Promise<void> | null = null;
let activeWorkspaceBox = 0;
let pendingActiveSaveAdoption: SaveFileId | null = null;

export function getSavesStorage() {
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

export function getCachedSavesSnapshot() {
	return savesSnapshot;
}

export function isCachedSavesSnapshotSeeded() {
	return savesSnapshot !== null && savesSnapshotSeeded;
}

export async function getSavesSnapshot(options: SavesSnapshotOptions = {}) {
	if (savesSnapshot && !options.force) {
		options.onUpdate?.(savesSnapshot);
		return savesSnapshot;
	}

	const generation = ++snapshotGeneration;
	const [activeSaveFileId, saveFiles] = await Promise.all([
		storage.getActiveSaveFileId(),
		storage.listSaves()
	]);
	const activeIds = new Set(saveFiles.map((saveFile) => saveFile.id));

	for (const saveFileId of detailsCache.keys()) {
		if (!activeIds.has(saveFileId)) detailsCache.delete(saveFileId);
	}

	const snapshot: SavesSnapshot = {
		activeSaveFileId,
		saveFiles,
		detailsBySaveFileId: Object.fromEntries(
			saveFiles.map((saveFile) => [
				saveFile.id,
				detailsCache.get(saveFile.id)?.fingerprint === createSaveFileFingerprint(saveFile)
					? detailsCache.get(saveFile.id)!.state
					: { status: 'loading' }
			])
		)
	};

	if (generation !== snapshotGeneration) return snapshot;
	savesSnapshot = snapshot;
	savesSnapshotSeeded = false;
	options.onUpdate?.(snapshot);

	for (const saveFile of saveFiles) {
		if (snapshot.detailsBySaveFileId[saveFile.id].status === 'loading') {
			void settleSaveCardDetails(saveFile, generation, options.onUpdate);
		}
	}

	return snapshot;
}

export function invalidateSavesCache() {
	snapshotGeneration += 1;
	savesSnapshot = null;
	savesSnapshotSeeded = false;
}

export function getCachedActiveWorkspace() {
	return workspaceService?.current ?? null;
}

export function getCachedActiveWorkspaceBox() {
	return activeWorkspaceBox;
}

export function setCachedActiveWorkspace(
	workspace: WorkspaceState | null,
	box = 0,
	options: { adoptAsActiveSave?: boolean } = {}
) {
	pendingActiveSaveAdoption = workspace && options.adoptAsActiveSave ? workspace.file.id : null;
	getActiveWorkspaceService().set(workspace, box);
	activeWorkspaceBox = box;
	if (workspace) detailsCache.delete(workspace.file.id);
	if (workspace && savesSnapshot)
		savesSnapshot = mergeWorkspaceIntoSnapshot(savesSnapshot, workspace);
}

export function consumeActiveSaveAdoption(saveFileId: SaveFileId) {
	if (pendingActiveSaveAdoption !== saveFileId) return false;
	pendingActiveSaveAdoption = null;
	return true;
}

export function invalidateActiveWorkspaceCache(saveFileId?: SaveFileId) {
	if (!saveFileId || workspaceService?.current?.file.id === saveFileId) {
		workspaceService?.set(null);
		activeWorkspaceBox = 0;
	}
}

export function seedSavesSnapshotFromActiveWorkspace(saveFiles: StoredSaveFile[]) {
	const workspace = workspaceService?.current ?? null;
	if (!workspace) return null;

	const nextSaveFiles = ensureSaveFileIncluded(saveFiles, workspace.file);
	const snapshot: SavesSnapshot = {
		activeSaveFileId: workspace.file.id,
		saveFiles: nextSaveFiles,
		detailsBySaveFileId: Object.fromEntries(
			nextSaveFiles.map((saveFile) => [saveFile.id, { status: 'loading' }])
		)
	};

	snapshotGeneration += 1;
	savesSnapshot = snapshot;
	savesSnapshotSeeded = true;
	detailsCache.delete(workspace.file.id);
	return snapshot;
}

export async function loadActiveWorkspaceFromSaves() {
	const activeSaveFileId = await storage.getActiveSaveFileId();
	const saveFile = activeSaveFileId ? await storage.getSave(activeSaveFileId) : null;
	const fallbackSaveFile = saveFile ?? (await storage.listSaves())[0] ?? null;

	if (!fallbackSaveFile) return null;

	const service = await startActiveWorkspaceService();
	const activeWorkspace = service.current;
	if (activeWorkspace && activeWorkspace.file.id === fallbackSaveFile.id) return activeWorkspace;

	const workspace = await service.hydrate(fallbackSaveFile.id, 0);
	activeWorkspaceBox = 0;
	return workspace;
}

async function settleSaveCardDetails(
	saveFile: StoredSaveFile,
	generation: number,
	onUpdate: SavesSnapshotOptions['onUpdate']
) {
	let details: SaveCardDetails | null;
	try {
		details = await loadSaveCardDetails(saveFile);
	} catch {
		details = null;
	}
	const state: Exclude<SaveCardDetailsState, { status: 'loading' }> = details
		? { status: 'ready', details }
		: { status: 'unavailable' };

	if (
		generation !== snapshotGeneration ||
		!savesSnapshot?.saveFiles.some((candidate) => candidate.id === saveFile.id)
	) {
		return;
	}

	detailsCache.set(saveFile.id, { fingerprint: createSaveFileFingerprint(saveFile), state });
	savesSnapshot = {
		...savesSnapshot,
		detailsBySaveFileId: {
			...savesSnapshot.detailsBySaveFileId,
			[saveFile.id]: state
		}
	};
	onUpdate?.(savesSnapshot);
}

function mergeWorkspaceIntoSnapshot(snapshot: SavesSnapshot, workspace: WorkspaceState) {
	const saveFiles = ensureSaveFileIncluded(snapshot.saveFiles, workspace.file);
	return {
		activeSaveFileId: workspace.file.id,
		saveFiles,
		detailsBySaveFileId: {
			...Object.fromEntries(saveFiles.map((saveFile) => [saveFile.id, { status: 'loading' }])),
			...snapshot.detailsBySaveFileId,
			[workspace.file.id]: { status: 'loading' }
		}
	} satisfies SavesSnapshot;
}

function ensureSaveFileIncluded(saveFiles: StoredSaveFile[], saveFile: StoredSaveFile) {
	return saveFiles.some((candidate) => candidate.id === saveFile.id)
		? saveFiles
		: [saveFile, ...saveFiles];
}

async function loadSaveCardDetails(saveFile: StoredSaveFile): Promise<SaveCardDetails | null> {
	const [storedBytes, persistedWorkspace] = await Promise.all([
		storage.getSaveBytes(saveFile.id),
		storage.getWorkspace(saveFile.id)
	]);
	const activeWorkspace = getCachedActiveWorkspace();
	const bytes =
		activeWorkspace?.file.id === saveFile.id
			? activeWorkspace.bytes
			: (persistedWorkspace?.bytes ?? storedBytes);
	if (!bytes) return null;

	const activeEngine = getPkhexEngine();
	const workspace = await activeEngine.loadSaveWorkspace(
		bytes,
		saveFile.originalFileName ?? undefined,
		0
	);
	if (!workspace.ok) return null;

	const creatureCount = await countSavePokemon(
		workspace.value.summary,
		workspace.value.boxSlots,
		(box) => activeEngine.listBoxSlots(bytes, saveFile.originalFileName ?? undefined, box)
	);
	if (creatureCount === null) return null;

	return {
		summary: workspace.value.summary,
		partySlots: workspace.value.partySlots,
		creatureCount
	};
}

export async function countSavePokemon(
	summary: SaveSummary,
	firstBoxSlots: BoxSlotSummary[],
	loadBoxSlots: (box: number) => Promise<EngineResult<BoxSlotSummary[]>>
) {
	let count = summary.partyCount + firstBoxSlots.filter((slot) => !slot.isEmpty).length;
	for (let box = 1; box < summary.boxCount; box += 1) {
		const slots = await loadBoxSlots(box);
		if (!slots.ok) return null;
		count += slots.value.filter((slot) => !slot.isEmpty).length;
	}
	return count;
}

function createSaveFileFingerprint(saveFile: StoredSaveFile) {
	return `${saveFile.importedAt}:${saveFile.byteLength}:${saveFile.originalFileName ?? ''}`;
}
