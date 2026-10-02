import { createPkhexWorkerEngine, type EngineApi, type SaveSummary } from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import { SaveFileEditCoordinator } from '$lib/pksx/save-file-edit-coordinator';
import {
	createPokemonStorageService,
	type PokemonStorageService
} from '$lib/pksx/pokemon-storage-catalog';
import {
	bytesEqual,
	createSavesStorage,
	type SaveFileId,
	type StoredSaveFile
} from '$lib/pksx/saves';
import {
	ActiveWorkspaceService,
	LocalStorageWorkspacePersistence
} from '$lib/pksx/workspace-store';

export type SaveCardDetails = {
	summary: SaveSummary;
	pokemonCount: number;
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

type StoredCardDetails = Record<SaveFileId, { digest: string; details: SaveCardDetails }>;

type SavesSnapshotOptions = {
	force?: boolean;
};

const storedCardDetailsKey = 'pksx-save-card-details-v1';
const storage = createSavesStorage();
const detailsCache = new Map<SaveFileId, SaveDetailsCacheEntry>();
const snapshotListeners = new Set<(snapshot: SavesSnapshot) => void>();
const catalogRequests = new Map<number, Promise<SavesSnapshot>>();
const detailGenerations = new Map<SaveFileId, number>();

let engine: EngineApi | null = null;
let savesSnapshot: SavesSnapshot | null = null;
let savesSnapshotSeeded = false;
let savesSnapshotValid = false;
let snapshotGeneration = 0;
let workspaceService: ActiveWorkspaceService | null = null;
let workspaceServiceStart: Promise<void> | null = null;
let activeWorkspaceBox = 0;
let engineWarmedUp = false;
let storedCardDetails: StoredCardDetails | null = null;
let publishedBytes: { saveFileId: SaveFileId; bytes: Uint8Array } | null = null;
let pendingActiveSaveAdoption: SaveFileId | null = null;
let saveFileEditCoordinator: SaveFileEditCoordinator | null = null;
let pokemonStorageCatalog: PokemonStorageService | null = null;
let pokemonStorageCatalogLoad: ReturnType<PokemonStorageService['loadOrMigrate']> | null = null;

export function getSavesStorage() {
	return storage;
}

export function getPkhexEngine() {
	engine ??= createPkhexWorkerEngine('/pkhex-engine');
	return engine;
}

export function getPokemonStorageCatalog() {
	pokemonStorageCatalog ??= createPokemonStorageService(getPkhexEngine());
	return pokemonStorageCatalog;
}

export async function ensurePokemonStorageCatalog() {
	const loading = (pokemonStorageCatalogLoad ??= getPokemonStorageCatalog().loadOrMigrate(() =>
		storage.getPokemonStorage()
	));
	try {
		return await loading;
	} finally {
		if (pokemonStorageCatalogLoad === loading) pokemonStorageCatalogLoad = null;
	}
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

export function getSaveFileEditCoordinator() {
	saveFileEditCoordinator ??= new SaveFileEditCoordinator({
		storage,
		engine: getPkhexEngine,
		publish: setCachedActiveWorkspace,
		isResultCurrent: ({ saveFileId }) => workspaceService?.current?.file.id === saveFileId
	});
	return saveFileEditCoordinator;
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

export function subscribeSavesSnapshot(listener: (snapshot: SavesSnapshot) => void) {
	snapshotListeners.add(listener);
	if (savesSnapshot && savesSnapshotValid) listener(savesSnapshot);
	return () => {
		snapshotListeners.delete(listener);
		if (snapshotListeners.size === 0 && !savesSnapshotValid) {
			savesSnapshot = null;
		}
	};
}

export function getSavesSnapshot(options: SavesSnapshotOptions = {}): Promise<SavesSnapshot> {
	if (savesSnapshot && savesSnapshotValid && !options.force) {
		return Promise.resolve(savesSnapshot);
	}

	const generation = ++snapshotGeneration;
	const request = loadSavesSnapshot(generation);
	catalogRequests.set(generation, request);
	void request.then(
		() => catalogRequests.delete(generation),
		() => catalogRequests.delete(generation)
	);
	return request;
}

async function loadSavesSnapshot(generation: number): Promise<SavesSnapshot> {
	// Start the engine now, so the first open does not wait for it.
	getPkhexEngine();
	const [activeSaveFileId, saveFiles] = await Promise.all([
		storage.getActiveSaveFileId(),
		storage.listSaves()
	]);
	const activeIds = new Set(saveFiles.map((saveFile) => saveFile.id));

	for (const saveFileId of detailsCache.keys()) {
		if (!activeIds.has(saveFileId)) detailsCache.delete(saveFileId);
	}
	const stored = readStoredCardDetails();
	if (Object.keys(stored).some((saveFileId) => !activeIds.has(saveFileId))) {
		writeStoredCardDetails(
			Object.fromEntries(Object.entries(stored).filter(([saveFileId]) => activeIds.has(saveFileId)))
		);
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

	if (generation !== snapshotGeneration) {
		return (
			catalogRequests.get(snapshotGeneration) ??
			(savesSnapshotValid ? savesSnapshot : null) ??
			getSavesSnapshot({ force: true })
		);
	}
	savesSnapshot = snapshot;
	savesSnapshotSeeded = false;
	savesSnapshotValid = true;
	publishSavesSnapshot();

	for (const saveFile of saveFiles) {
		if (snapshot.detailsBySaveFileId[saveFile.id].status === 'loading') {
			scheduleSaveCardDetails(saveFile);
		} else {
			supersedeSaveCardDetails(saveFile.id);
		}
	}

	return snapshot;
}

export function invalidateSavesCache() {
	snapshotGeneration += 1;
	savesSnapshotSeeded = false;
	savesSnapshotValid = false;
	if (snapshotListeners.size === 0) {
		savesSnapshot = null;
	}
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
	activeWorkspaceBox = box;
	getActiveWorkspaceService().set(workspace, box);
	const previousBytes = publishedBytes;
	publishedBytes = workspace ? { saveFileId: workspace.file.id, bytes: workspace.bytes } : null;
	if (!workspace) return;
	if (
		previousBytes?.saveFileId === workspace.file.id &&
		detailsCache.has(workspace.file.id) &&
		savesSnapshot?.activeSaveFileId === workspace.file.id &&
		bytesEqual(previousBytes.bytes, workspace.bytes)
	) {
		return;
	}
	detailsCache.delete(workspace.file.id);
	const detailGeneration = supersedeSaveCardDetails(workspace.file.id);
	if (!savesSnapshot) return;
	if (snapshotListeners.size === 0) {
		invalidateSavesCache();
		return;
	}
	savesSnapshot = mergeWorkspaceIntoSnapshot(savesSnapshot, workspace);
	publishSavesSnapshot();
	queueSaveCardDetails(workspace.file, detailGeneration);
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
		publishedBytes = null;
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
	savesSnapshotValid = true;
	for (const saveFile of nextSaveFiles) supersedeSaveCardDetails(saveFile.id);
	detailsCache.delete(workspace.file.id);
	publishSavesSnapshot();
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

/** Loads the Workspace that opening a Save File uses; `published` is true when it is already active. */
export async function loadWorkspaceForOpening(saveFileId: SaveFileId) {
	const service = await startActiveWorkspaceService();
	const current = service.current;
	if (current?.file.id === saveFileId) return { state: current, published: true };
	const state = await service.load(saveFileId, 0);
	return state ? { state, published: false } : null;
}

function supersedeSaveCardDetails(saveFileId: SaveFileId) {
	const detailGeneration = (detailGenerations.get(saveFileId) ?? 0) + 1;
	detailGenerations.set(saveFileId, detailGeneration);
	return detailGeneration;
}

function scheduleSaveCardDetails(saveFile: StoredSaveFile) {
	void settleSaveCardDetails(saveFile, supersedeSaveCardDetails(saveFile.id));
}

function queueSaveCardDetails(saveFile: StoredSaveFile, detailGeneration: number) {
	queueMicrotask(() => {
		if (
			detailGeneration !== detailGenerations.get(saveFile.id) ||
			!savesSnapshot?.saveFiles.some((candidate) => candidate.id === saveFile.id)
		) {
			return;
		}
		void settleSaveCardDetails(saveFile, detailGeneration);
	});
}

async function settleSaveCardDetails(saveFile: StoredSaveFile, detailGeneration: number) {
	let details: SaveCardDetails | null;
	try {
		details = await loadSaveCardDetails(saveFile);
	} catch {
		details = null;
	}
	const state: Exclude<SaveCardDetailsState, { status: 'loading' }> = details
		? { status: 'ready', details }
		: { status: 'unavailable' };

	const catalogRequest = catalogRequests.get(snapshotGeneration);
	if (catalogRequest) await catalogRequest.catch(() => undefined);

	if (
		detailGeneration !== detailGenerations.get(saveFile.id) ||
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
	publishSavesSnapshot();
}

function publishSavesSnapshot() {
	if (!savesSnapshot) return;
	for (const listener of snapshotListeners) listener(savesSnapshot);
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
	const activeWorkspace = getCachedActiveWorkspace();
	let bytes = activeWorkspace?.file.id === saveFile.id ? activeWorkspace.bytes : null;
	if (!bytes) {
		// These details describe other bytes than the published ones.
		if (publishedBytes?.saveFileId === saveFile.id) publishedBytes = null;
		bytes =
			(await storage.getWorkspace(saveFile.id))?.bytes ?? (await storage.getSaveBytes(saveFile.id));
	}
	if (!bytes) return null;

	// Unchanged bytes keep their stored details, so cards rarely need the engine.
	const digest = await digestBytes(bytes);
	const stored = readStoredCardDetails()[saveFile.id];
	const fileName = saveFile.originalFileName ?? undefined;
	if (!engineWarmedUp && saveFile.id === savesSnapshot?.activeSaveFileId) {
		// The first Workspace load of a session is slow. Do it now, for the likeliest open.
		engineWarmedUp = true;
		void getPkhexEngine().loadSaveWorkspace(bytes, fileName, 0, { background: true });
	}
	if (stored?.digest === digest) return stored.details;

	const card = await getPkhexEngine().summarizeSaveCard(bytes, fileName);
	if (!card.ok) return null;
	const details = { summary: card.value.summary, pokemonCount: card.value.pokemonCount };
	writeStoredCardDetails({ ...readStoredCardDetails(), [saveFile.id]: { digest, details } });
	return details;
}

async function digestBytes(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readStoredCardDetails(): StoredCardDetails {
	if (storedCardDetails) return storedCardDetails;
	try {
		storedCardDetails = JSON.parse(globalThis.localStorage?.getItem(storedCardDetailsKey) ?? '{}');
	} catch {
		storedCardDetails = {};
	}
	return (storedCardDetails ??= {});
}

function writeStoredCardDetails(next: StoredCardDetails) {
	storedCardDetails = next;
	try {
		globalThis.localStorage?.setItem(storedCardDetailsKey, JSON.stringify(next));
	} catch {
		// Stored details are an optimization; the in-memory copy still serves this session.
	}
}

/** Drops the in-memory card details, as a new app session does. */
export function forgetSaveCardDetails() {
	detailsCache.clear();
}

function createSaveFileFingerprint(saveFile: StoredSaveFile) {
	return `${saveFile.importedAt}:${saveFile.byteLength}:${saveFile.originalFileName ?? ''}`;
}
