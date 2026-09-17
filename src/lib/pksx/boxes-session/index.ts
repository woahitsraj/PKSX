import { createBoxPane, type BoxPaneState, type BoxSourceRef } from '$lib/pksx/storage-workbench';

export type BoxesSessionState = {
	panes: BoxPaneState[];
	activePaneId: string;
};

type PersistedBoxesSession = {
	primary: BoxPaneState;
};

export type BoxesSessionPersistence = {
	load(): unknown;
	save(state: PersistedBoxesSession): void;
};

type RestoreOptions = {
	saveFiles: BoxSourceRef[];
	activeSaveFileId: string | null;
	pokemonStorageBoxCount?: number;
};

export class BoxesSessionService {
	private current: BoxesSessionState | null = null;

	constructor(private readonly persistence?: BoxesSessionPersistence) {}

	restore(options: RestoreOptions): BoxesSessionState {
		const session = this.current ?? this.persistedState();
		const panes = session?.panes
			.map((pane) => this.resolvePane(pane, options))
			.filter((pane): pane is BoxPaneState => pane !== null)
			.slice(0, this.current ? 2 : 1);
		const primary = panes?.[0] ?? this.fallbackPrimary(options);
		const restoredPanes = panes?.length ? panes : [primary];
		const activePaneId = restoredPanes.some((pane) => pane.id === session?.activePaneId)
			? session!.activePaneId
			: primary.id;
		this.current = { panes: restoredPanes, activePaneId };
		this.persist();
		return this.snapshot();
	}

	set(state: BoxesSessionState): BoxesSessionState {
		this.current = cloneState(state);
		this.persist();
		return this.snapshot();
	}

	selectPrimary(source: BoxSourceRef, boxCount = 1): BoxesSessionState {
		return this.set({
			panes: [createBoxPane('pane-primary', source, { boxCount })],
			activePaneId: 'pane-primary'
		});
	}

	private persistedState(): BoxesSessionState | null {
		const value = this.persistence?.load();
		if (!isPersistedBoxesSession(value)) return null;
		return { panes: [value.primary], activePaneId: value.primary.id };
	}

	private resolvePane(pane: BoxPaneState, options: RestoreOptions): BoxPaneState | null {
		if (pane.source.type === 'pokemon-storage') {
			return createBoxPane(pane.id, pokemonStorageSource(), {
				activeBox: pane.activeBox,
				boxCount: options.pokemonStorageBoxCount ?? pane.boxCount,
				focus: pane.focus
			});
		}

		const source = options.saveFiles.find(
			(candidate) => candidate.type === 'save-file' && candidate.id === pane.source.id
		);
		return source
			? createBoxPane(pane.id, source, {
					activeBox: pane.activeBox,
					boxCount: pane.boxCount,
					focus: pane.focus
				})
			: null;
	}

	private fallbackPrimary(options: RestoreOptions): BoxPaneState {
		const source =
			options.saveFiles.find(
				(candidate) => candidate.type === 'save-file' && candidate.id === options.activeSaveFileId
			) ?? options.saveFiles.find((candidate) => candidate.type === 'save-file');
		return createBoxPane('pane-primary', source ?? pokemonStorageSource(), {
			boxCount: source ? 1 : (options.pokemonStorageBoxCount ?? 1)
		});
	}

	private persist() {
		const primary = this.current?.panes[0];
		if (primary) this.persistence?.save({ primary: clonePane(primary) });
	}

	private snapshot(): BoxesSessionState {
		if (!this.current) throw new Error('Boxes session has not been restored.');
		return cloneState(this.current);
	}
}

export class LocalStorageBoxesSessionPersistence implements BoxesSessionPersistence {
	constructor(
		private readonly key = 'pksx-boxes-session-v1',
		private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
	) {}

	load() {
		const value = this.storage.getItem(this.key);
		if (!value) return null;
		try {
			return JSON.parse(value) as unknown;
		} catch {
			return null;
		}
	}

	save(state: PersistedBoxesSession) {
		this.storage.setItem(this.key, JSON.stringify(state));
	}
}

let boxesSession: BoxesSessionService | null = null;

export function getBoxesSession() {
	boxesSession ??= new BoxesSessionService(
		typeof localStorage === 'undefined' ? undefined : new LocalStorageBoxesSessionPersistence()
	);
	return boxesSession;
}

function pokemonStorageSource(): BoxSourceRef {
	return { type: 'pokemon-storage', id: 'pokemon-storage', label: 'Pokemon Storage' };
}

function cloneState(state: BoxesSessionState): BoxesSessionState {
	return { panes: state.panes.map(clonePane), activePaneId: state.activePaneId };
}

function clonePane(pane: BoxPaneState): BoxPaneState {
	return { ...pane, source: { ...pane.source }, focus: { ...pane.focus } };
}

function isPersistedBoxesSession(value: unknown): value is PersistedBoxesSession {
	if (!value || typeof value !== 'object' || !('primary' in value)) return false;
	const primary = value.primary;
	if (!primary || typeof primary !== 'object') return false;
	const pane = primary as Partial<BoxPaneState>;
	return (
		typeof pane.id === 'string' &&
		Boolean(pane.source) &&
		(pane.source?.type === 'save-file' || pane.source?.type === 'pokemon-storage') &&
		typeof pane.activeBox === 'number' &&
		typeof pane.boxCount === 'number' &&
		Boolean(pane.focus) &&
		(pane.focus?.zone === 'party' || pane.focus?.zone === 'box') &&
		typeof pane.focus?.slot === 'number'
	);
}
