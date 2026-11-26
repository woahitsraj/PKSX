<script module lang="ts">
	let rememberedTargetKey: string | null = null;
</script>

<script lang="ts">
	import { goto, preloadCode } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import SavesIntroduction from '$lib/components/pksx/SavesIntroduction.svelte';
	import DelayedSpinner from '$lib/components/pksx/DelayedSpinner.svelte';
	import RenameSaveFile from '$lib/components/pksx/RenameSaveFile.svelte';
	import { getSaveDisplayName } from '$lib/pksx/saves';
	import {
		filterSortSaves,
		getSaveGameTitle,
		readSavesSort,
		writeSavesSort,
		type SavesSort
	} from '$lib/pksx/saves-library';
	import SaveFileMenu from '$lib/components/pksx/SaveFileMenu.svelte';
	import StorageBackupMenu from '$lib/components/pksx/StorageBackupMenu.svelte';
	import AddSavesMenu from '$lib/components/pksx/AddSavesMenu.svelte';
	import HiddenSavesMenu from '$lib/components/pksx/HiddenSavesMenu.svelte';
	import { folderOf, supportsSaveFolders } from '$lib/pksx/linked-save-folders';
	import { recoveryBackupId } from '$lib/pksx/linked-save-sources/runtime';
	import { fileEmulator } from '$lib/pksx/linked-save-folders/profiles';
	import { linkedSaveDiscovery as discovery } from '$lib/pksx/linked-save-folders/runtime.svelte';
	import type { EngineError } from '$lib/engine';
	import { appChrome } from '$lib/pksx/app-chrome.svelte';
	import { getBoxesSession } from '$lib/pksx/boxes-session';
	import { isControllerKeyboardEvent } from '$lib/pksx/controller-input';
	import { easeOut, reducedMotion } from '$lib/pksx/motion';
	import {
		deleteSavesTarget,
		moveSavesTarget,
		resolveSavesTarget,
		sameSavesTarget,
		type SavesDirection,
		type SavesTarget
	} from '$lib/pksx/saves-navigation';
	import type { SaveFileId, StoredSaveFile } from '$lib/pksx/saves';
	import {
		CatalogOutcomeUnknownError,
		type PokemonStorageManifest
	} from '$lib/pksx/pokemon-storage-catalog';
	import {
		getCachedActiveWorkspace,
		getCachedActiveWorkspaceBox,
		getCachedSavesSnapshot,
		getPkhexEngine,
		getPokemonStorageCatalog,
		getSaveFileEditCoordinator,
		getSavesSnapshot,
		getSavesStorage,
		ensurePokemonStorageCatalog,
		invalidateActiveWorkspaceCache,
		invalidateSavesCache,
		isCachedSavesSnapshotSeeded,
		loadWorkspaceForOpening,
		setCachedActiveWorkspace,
		subscribeSavesSnapshot,
		type SaveCardDetailsState,
		type SavesSnapshot
	} from '$lib/pksx/saves-cache';
	import { getSummonedWorkflowHost } from '$lib/pksx/summoned-workflow/host.svelte';
	import { getToastHost } from '$lib/pksx/toast/host.svelte';

	function cardRise(node: Element, { index }: { index: number }) {
		void node;
		const fade = reducedMotion();
		return {
			delay: fade ? 0 : 30 * Math.min(index, 5),
			duration: fade ? 120 : 160,
			easing: easeOut,
			css: (t: number, u: number) =>
				fade ? `opacity: ${t}` : `opacity: ${t}; transform: translateY(${(u * 4).toFixed(2)}px)`
		};
	}

	type PokemonStorageSummary = { boxCount: number; pokemonCount: number };
	type SavesGridEntry =
		| { kind: 'save-file'; saveFile: StoredSaveFile; index: number }
		| { kind: 'pokemon-storage'; index: number }
		| { kind: 'import'; index: number };
	const storage = getSavesStorage();
	const boxesSession = getBoxesSession();
	const summonedWorkflow = getSummonedWorkflowHost();
	const toastHost = getToastHost();

	let query = $state('');
	let sort = $state<SavesSort>('alphabetical');
	let searchControls: HTMLElement;
	let tabDirection: 'forward' | 'backward' | null = null;
	let saveFiles = $state<StoredSaveFile[]>([]);
	let activeSaveFileId = $state<SaveFileId | null>(null);
	let detailsBySaveFileId = $state<Record<SaveFileId, SaveCardDetailsState>>({});
	let pokemonStorage = $state<PokemonStorageSummary>({ boxCount: 1, pokemonCount: 0 });
	let target = $state<SavesTarget>({ kind: 'import' });
	let gridElement = $state<HTMLElement>();
	let gridList = $state<HTMLElement>();
	let columnCount = $state(1);
	let catalogLoading = $state(true);
	let busyTarget = $state<SaveFileId | 'import' | 'pokemon-storage' | null>(null);
	let menuSaveFileId = $state<SaveFileId | null>(null);
	let menuReturnTarget = $state<SavesTarget | null>(null);
	let menuIndex = $state(0);
	let deleteDescription = $state<string | null>(null);
	let storageBackupIndex = $state(0);
	let storageRecoveryAvailable = $state(false);
	let pendingStorageArchive = $state<Uint8Array | null>(null);
	let storageConfirmation = $state<string | null>(null);
	let recoveryRequested = $state(false);
	let refreshRequest = 0;

	const visibleSaveFiles = $derived(
		filterSortSaves({ files: saveFiles, details: detailsBySaveFileId, query, sort })
	);

	const searching = $derived(query.trim() !== '');
	const hiddenSaveFiles = $derived(
		filterSortSaves({
			files: saveFiles,
			details: detailsBySaveFileId,
			query: '',
			sort,
			hidden: true
		})
	);
	const libraryCount = $derived(saveFiles.length - hiddenSaveFiles.length);

	const targets = $derived<SavesTarget[]>([
		...visibleSaveFiles.map((saveFile) => ({ kind: 'save-file' as const, id: saveFile.id })),
		{ kind: 'pokemon-storage' },
		{ kind: 'import' }
	]);
	const menuSaveFile = $derived(
		saveFiles.find((saveFile) => saveFile.id === menuSaveFileId) ?? null
	);
	const menuSource = $derived(menuSaveFile ? discovery.sources[menuSaveFile.id] : undefined);
	let replaceEdits = $state(false);
	const menuOpen = $derived(summonedWorkflow.active?.kind === 'save-file-menu');
	const renameOpen = $derived(summonedWorkflow.active?.kind === 'save-file-rename');
	const deleteOpen = $derived(summonedWorkflow.active?.kind === 'save-file-delete');
	const addSavesOpen = $derived(summonedWorkflow.active?.kind === 'add-saves-menu');
	const hiddenSavesOpen = $derived(summonedWorkflow.active?.kind === 'hidden-saves-menu');
	const folderLinking = supportsSaveFolders();
	const storageBackupOpen = $derived(summonedWorkflow.active?.kind === 'storage-backup-menu');
	const storageConfirmOpen = $derived(
		summonedWorkflow.active?.kind === 'storage-backup-confirmation'
	);
	const activeTargetId = $derived(targetDomId(target));
	const rowCount = $derived(Math.max(1, Math.ceil(targets.length / columnCount)));
	const gridEntries = $derived<SavesGridEntry[]>([
		...visibleSaveFiles.map((saveFile, index) => ({ kind: 'save-file' as const, saveFile, index })),
		{ kind: 'pokemon-storage', index: visibleSaveFiles.length },
		{ kind: 'import', index: visibleSaveFiles.length + 1 }
	]);
	const gridRows = $derived.by(() => {
		const rows: SavesGridEntry[][] = [];
		for (let index = 0; index < gridEntries.length; index += columnCount) {
			rows.push(gridEntries.slice(index, index + columnCount));
		}
		return rows;
	});

	$effect(() => {
		appChrome.hasLoadedSave = activeSaveFileId !== null;
		appChrome.carryActive = false;
	});

	onMount(() => {
		sort = readSavesSort();
		const cached = getCachedSavesSnapshot();
		const seeded = isCachedSavesSnapshotSeeded();
		let hasReceivedSnapshot = false;
		const unsubscribe = subscribeSavesSnapshot((snapshot) => {
			applySnapshot(snapshot, hasReceivedSnapshot ? target : rememberedTarget());
			hasReceivedSnapshot = true;
		});

		void refreshSaves({ force: !cached || seeded }).then(() => focusGrid());
		// Opening a Save File goes to Boxes, so load that route's code ahead of the first open.
		void preloadCode(resolve('/boxes')).catch(() => undefined);
		return unsubscribe;
	});

	function savesGridOwner(node: HTMLElement) {
		gridElement = node;
		return () => {
			if (gridElement === node) gridElement = undefined;
		};
	}

	function savesGridContent(node: HTMLElement) {
		gridList = node;
		const observer = new ResizeObserver(() => {
			updateColumnCount();
			void scrollTargetIntoView();
		});
		observer.observe(node);
		updateColumnCount();
		return () => {
			observer.disconnect();
			if (gridList === node) gridList = undefined;
		};
	}

	function targetKey(value: SavesTarget) {
		return value.kind === 'save-file' ? 'save-file:' + value.id : value.kind;
	}

	function gridRowKey(row: SavesGridEntry[]) {
		return row
			.map((entry) => (entry.kind === 'save-file' ? 'save-file:' + entry.saveFile.id : entry.kind))
			.join('|');
	}

	function rememberedTarget(): SavesTarget | null {
		if (rememberedTargetKey === 'import') return { kind: 'import' };
		if (rememberedTargetKey === 'pokemon-storage') return { kind: 'pokemon-storage' };
		return rememberedTargetKey?.startsWith('save-file:')
			? { kind: 'save-file', id: rememberedTargetKey.slice('save-file:'.length) }
			: null;
	}

	function rememberTarget(value: SavesTarget) {
		rememberedTargetKey = targetKey(value);
	}

	function targetDomId(value: SavesTarget) {
		return value.kind === 'save-file'
			? 'saves-target-' + encodeURIComponent(value.id)
			: 'saves-target-' + value.kind;
	}

	function currentTargets(saveFileList = visibleSaveFiles): SavesTarget[] {
		return [
			...saveFileList.map((saveFile) => ({ kind: 'save-file' as const, id: saveFile.id })),
			{ kind: 'pokemon-storage' },
			{ kind: 'import' }
		];
	}

	function applySnapshot(
		snapshot: SavesSnapshot,
		preferredTarget: SavesTarget | null,
		shouldFocus = false
	) {
		if (menuSaveFileId && !snapshot.saveFiles.some((file) => file.id === menuSaveFileId)) {
			if (menuOpen || deleteOpen || renameOpen) {
				summonedWorkflow.closeAll();
				shouldFocus = true;
			}
			menuSaveFileId = null;
			menuReturnTarget = null;
			deleteDescription = null;
		}
		saveFiles = snapshot.saveFiles;
		activeSaveFileId = snapshot.activeSaveFileId;
		detailsBySaveFileId = snapshot.detailsBySaveFileId;
		const nextTargets = currentTargets(
			filterSortSaves({
				files: snapshot.saveFiles,
				details: snapshot.detailsBySaveFileId,
				query,
				sort
			})
		);
		target = resolveSavesTarget(
			nextTargets,
			preferredTarget ?? rememberedTarget(),
			snapshot.activeSaveFileId
		);
		rememberTarget(target);
		catalogLoading = false;
		if (shouldFocus) void focusGrid();
	}

	async function refreshSaves(
		options: { force?: boolean; preferredTarget?: SavesTarget; focus?: boolean } = {}
	) {
		const request = ++refreshRequest;
		try {
			const storageSummary = ensurePokemonStorageCatalog().then(
				(value) => ({ ok: true as const, value }),
				(error: unknown) => ({ ok: false as const, error })
			);
			const snapshot = await getSavesSnapshot({ force: options.force });
			if (request !== refreshRequest) return;
			applySnapshot(snapshot, options.preferredTarget ?? rememberedTarget(), options.focus);
			const resolvedStorageSummary = await storageSummary;
			if (request !== refreshRequest) return;
			if (!resolvedStorageSummary.ok) throw resolvedStorageSummary.error;
			pokemonStorage = summarizePokemonStorage(resolvedStorageSummary.value);
		} catch (error) {
			if (request !== refreshRequest) return;
			catalogLoading = false;
			toastHost.error(getErrorMessage(error));
			if (options.focus) await focusGrid();
		}
	}

	function summarizePokemonStorage(value: PokemonStorageManifest): PokemonStorageSummary {
		return {
			boxCount: value.boxes.length,
			pokemonCount: value.records.length
		};
	}

	function chooseTarget(next: SavesTarget, focus = true) {
		target = next;
		rememberTarget(next);
		if (focus) void focusGrid();
		else void scrollTargetIntoView();
	}

	async function focusGrid() {
		await tick();
		gridElement?.focus();
		await scrollTargetIntoView();
	}

	async function scrollTargetIntoView() {
		await tick();
		document
			.getElementById(targetDomId(target))
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function updateColumnCount() {
		if (!gridList) return;
		const columns = getComputedStyle(gridList)
			.gridTemplateColumns.split(' ')
			.filter(Boolean).length;
		columnCount = Math.max(1, columns);
	}

	function handleKeydown(event: KeyboardEvent) {
		tabDirection = event.key === 'Tab' ? (event.shiftKey ? 'backward' : 'forward') : null;
		if (
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			(event.shiftKey && event.key !== 'Tab') ||
			(isTextEntryTarget(event.target) && !searchControls?.contains(document.activeElement))
		) {
			return;
		}
		if (addSavesOpen || hiddenSavesOpen) return;
		if (!summonedWorkflow.active && searchControls?.contains(document.activeElement)) {
			handleSearchKeydown(event);
			return;
		}
		if (renameOpen) return;
		if (storageBackupOpen || storageConfirmOpen) {
			handleStorageBackupKeydown(event);
			return;
		}
		if (menuOpen || deleteOpen || renameOpen) {
			handleMenuKeydown(event);
			return;
		}
		if (summonedWorkflow.active) return;
		if (
			!isControllerKeyboardEvent(event) &&
			(!gridElement || !event.composedPath().includes(gridElement)) &&
			event
				.composedPath()
				.some(
					(node) =>
						node instanceof HTMLElement &&
						(node.tabIndex >= 0 ||
							node.matches(
								'button, a[href], input, select, textarea, summary, [role="button"], [role="link"]'
							))
				)
		) {
			return;
		}

		const direction = directionForKey(event.key);
		if (direction) {
			event.preventDefault();
			if (
				direction === 'up' &&
				targets.findIndex((entry) => sameSavesTarget(entry, target)) < columnCount
			) {
				document.getElementById('saves-search')?.focus();
			} else chooseTarget(moveSavesTarget(targets, target, columnCount, direction));
			return;
		}

		if (event.key.toLowerCase() === 'x') {
			if (target.kind === 'save-file') {
				event.preventDefault();
				openSaveFileMenu(target.id);
			} else if (target.kind === 'pokemon-storage') {
				event.preventDefault();
				void openStorageBackupMenu();
			}
			return;
		}

		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		activateTarget();
	}

	function isTextEntryTarget(value: EventTarget | null) {
		return (
			value instanceof HTMLInputElement ||
			value instanceof HTMLTextAreaElement ||
			value instanceof HTMLSelectElement ||
			(value instanceof HTMLElement && value.isContentEditable)
		);
	}

	function directionForKey(key: string): SavesDirection | null {
		switch (key) {
			case 'ArrowLeft':
				return 'left';
			case 'ArrowRight':
				return 'right';
			case 'ArrowUp':
				return 'up';
			case 'ArrowDown':
				return 'down';
			default:
				return null;
		}
	}

	function activateTarget() {
		if (busyTarget) return;
		const currentTarget = target;
		if (currentTarget.kind === 'import') {
			openAddSaves();
			return;
		}
		if (currentTarget.kind === 'pokemon-storage') {
			void openPokemonStorage();
			return;
		}
		const saveFile = saveFiles.find((candidate) => candidate.id === currentTarget.id);
		if (saveFile) void activateSaveFile(saveFile, 'boxes');
	}

	async function openPokemonStorage() {
		if (busyTarget) return;
		chooseTarget({ kind: 'pokemon-storage' }, false);
		boxesSession.selectPrimary(
			{ type: 'pokemon-storage', id: 'pokemon-storage', label: 'Pokemon Storage' },
			pokemonStorage.boxCount
		);
		await goto(resolve('/boxes'));
	}

	async function openStorageBackupMenu() {
		if (
			busyTarget ||
			!summonedWorkflow.open('storage-backup-menu', {
				type: 'control',
				id: 'saves-target-pokemon-storage'
			})
		)
			return;
		chooseTarget({ kind: 'pokemon-storage' }, false);
		storageBackupIndex = 0;
		try {
			storageRecoveryAvailable = Boolean(await getPokemonStorageCatalog().preRestoreRecovery());
		} catch (error) {
			toastHost.error(getErrorMessage(error));
		}
		void focusStorageBackupCommand();
	}

	function dismissStorageBackup() {
		if (busyTarget) return;
		if (storageConfirmOpen) {
			storageBackupIndex = recoveryRequested ? 2 : 1;
			pendingStorageArchive = null;
			storageConfirmation = null;
			recoveryRequested = false;
			summonedWorkflow.dismiss();
			void focusStorageBackupCommand();
			return;
		}
		pendingStorageArchive = null;
		storageConfirmation = null;
		recoveryRequested = false;
		summonedWorkflow.dismiss();
		void focusGrid();
	}

	async function exportStorageBackup() {
		if (busyTarget) return;
		busyTarget = 'pokemon-storage';
		try {
			const bytes = await getPokemonStorageCatalog().exportArchive();
			const copy = new Uint8Array(bytes);
			const url = URL.createObjectURL(
				new Blob([copy.buffer], { type: 'application/octet-stream' })
			);
			const link = document.createElement('a');
			link.href = url;
			link.download = `pokemon-storage-${new Date().toISOString().slice(0, 10)}.pksx-storage`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			toastHost.success('Pokemon Storage backup exported.');
		} catch (error) {
			toastHost.error('Could not export Pokemon Storage. ' + getErrorMessage(error));
		} finally {
			busyTarget = null;
		}
	}

	async function handleStorageArchive(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busyTarget = 'pokemon-storage';
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const summary = await getPokemonStorageCatalog().inspectArchive(bytes);
			pendingStorageArchive = bytes;
			recoveryRequested = false;
			storageConfirmation = `This replaces the entire current Pokemon Storage with ${summary.pokemonCount} Pokemon in ${summary.boxCount} Storage Boxes from ${new Date(summary.exportedAt).toLocaleString()}. Recently Deleted records are included. PKSX saves a recoverable snapshot of the current collection first.`;
			summonedWorkflow.openRelated('storage-backup-confirmation', {
				type: 'control',
				id: 'storage-backup-command-1'
			});
			storageBackupIndex = 0;
			void focusStorageBackupCommand();
		} catch (error) {
			toastHost.error(
				'Backup was rejected. Current Pokemon Storage was not changed. ' + getErrorMessage(error)
			);
		} finally {
			busyTarget = null;
		}
	}

	let recoveryLoading = false;

	async function requestStorageRecovery() {
		const launchingWorkflow = summonedWorkflow.active;
		if (recoveryLoading || busyTarget || launchingWorkflow?.kind !== 'storage-backup-menu') return;
		recoveryLoading = true;
		try {
			const recovery = await getPokemonStorageCatalog().preRestoreRecovery();
			if (summonedWorkflow.active !== launchingWorkflow) return;
			if (!recovery) throw new Error('No pre-restore snapshot is available.');
			pendingStorageArchive = null;
			recoveryRequested = true;
			storageConfirmation = `This replaces the entire current Pokemon Storage with the snapshot saved ${new Date(recovery.createdAt).toLocaleString()}. PKSX saves the current collection as the next recoverable snapshot.`;
			summonedWorkflow.openRelated('storage-backup-confirmation', {
				type: 'control',
				id: 'storage-backup-command-2'
			});
			storageBackupIndex = 0;
			void focusStorageBackupCommand();
		} catch (error) {
			if (summonedWorkflow.active === launchingWorkflow) toastHost.error(getErrorMessage(error));
		} finally {
			recoveryLoading = false;
		}
	}

	async function confirmStorageReplacement() {
		if (busyTarget) return;
		busyTarget = 'pokemon-storage';
		const catalog = getPokemonStorageCatalog();
		const previousRevision = catalog.current?.revision;
		try {
			if (recoveryRequested) await catalog.recoverPreRestore();
			else if (pendingStorageArchive) await catalog.restoreArchive(pendingStorageArchive);
			else throw new Error('The selected backup is no longer available.');
			await finishStorageReplacement();
		} catch (error) {
			if (error instanceof CatalogOutcomeUnknownError) {
				try {
					const settled = await catalog.load();
					if (settled && settled.revision === (previousRevision ?? -1) + 1) {
						await finishStorageReplacement();
						return;
					}
					summonedWorkflow.closeAll();
					await refreshSaves({
						force: true,
						preferredTarget: { kind: 'pokemon-storage' },
						focus: true
					});
					toastHost.error('Pokemon Storage was not replaced. The current collection is unchanged.');
				} catch {
					summonedWorkflow.closeAll();
					toastHost.error(
						'Pokemon Storage replacement is unconfirmed. Reload before changing Storage.'
					);
				}
			} else toastHost.error('Could not replace Pokemon Storage. ' + getErrorMessage(error));
		} finally {
			busyTarget = null;
		}
	}

	async function finishStorageReplacement() {
		storageRecoveryAvailable = true;
		pendingStorageArchive = null;
		storageConfirmation = null;
		recoveryRequested = false;
		summonedWorkflow.closeAll();
		await refreshSaves({ force: true, preferredTarget: { kind: 'pokemon-storage' }, focus: true });
		toastHost.success(
			'Pokemon Storage replaced. Previous Storage is recoverable from its Backup Menu.'
		);
	}

	function handleStorageBackupKeydown(event: KeyboardEvent) {
		if (
			!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(
				event.key
			)
		)
			return;
		event.preventDefault();
		if (event.key === 'Escape') {
			dismissStorageBackup();
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			if (busyTarget) return;
			if (storageConfirmOpen) {
				if (storageBackupIndex === 0) dismissStorageBackup();
				else void confirmStorageReplacement();
			} else if (storageBackupIndex === 0) void exportStorageBackup();
			else if (storageBackupIndex === 1) document.getElementById('storage-backup-input')?.click();
			else if (storageRecoveryAvailable) void requestStorageRecovery();
			return;
		}
		storageBackupIndex = Math.max(
			0,
			Math.min(
				storageConfirmOpen ? 1 : storageRecoveryAvailable ? 2 : 1,
				storageBackupIndex + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1)
			)
		);
		void focusStorageBackupCommand();
	}

	async function focusStorageBackupCommand() {
		await tick();
		document.getElementById(`storage-backup-command-${storageBackupIndex}`)?.focus();
	}

	function openAddSaves() {
		if (!folderLinking) return openImportPicker();
		if (
			busyTarget ||
			!summonedWorkflow.open('add-saves-menu', { type: 'control', id: 'saves-target-import' })
		)
			return;
		chooseTarget({ kind: 'import' }, false);
	}

	function closeAddSaves(then?: () => void) {
		summonedWorkflow.dismiss();
		void focusGrid();
		then?.();
	}

	function openImportPicker() {
		if (busyTarget) return;
		chooseTarget({ kind: 'import' });
		document.getElementById('save-file-input')?.click();
	}

	function handleImportCancel() {
		chooseTarget({ kind: 'import' });
	}

	async function handleImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			handleImportCancel();
			return;
		}

		busyTarget = 'import';
		refreshRequest += 1;
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const validation = await getPkhexEngine().loadSaveWorkspace(bytes, file.name, 0);
			if (!validation.ok) throw validation.error;
			const stored = await storage.importSave({ bytes, originalFileName: file.name });
			boxesSession.selectPrimary({
				type: 'save-file',
				id: stored.id,
				label: stored.originalFileName ?? 'Save File',
				dirty: false
			});
			invalidateSavesCache();
			invalidateActiveWorkspaceCache();
			await refreshSaves({
				force: true,
				preferredTarget: { kind: 'save-file', id: stored.id },
				focus: true
			});
			toastHost.success(file.name + ' imported and made active.');
		} catch (error) {
			await refreshSaves({
				preferredTarget: { kind: 'import' },
				focus: true
			});
			toastHost.error(
				'Import failed. Current active Save File was not changed. ' + getErrorMessage(error)
			);
		} finally {
			busyTarget = null;
		}
	}

	async function activateSaveFile(
		saveFile: StoredSaveFile,
		destination: 'boxes' | 'trainer' | 'bag'
	) {
		if (busyTarget) return;
		busyTarget = saveFile.id;
		try {
			const opening = await loadWorkspaceForOpening(saveFile.id);
			if (!opening) throw new Error('The selected Save File is no longer available.');
			const current = opening.state.file;

			if (current.id !== activeSaveFileId) {
				await storage.setActiveSaveFileId(current.id);
				invalidateSavesCache();
			}
			if (!opening.published) setCachedActiveWorkspace(opening.state, 0);
			boxesSession.selectPrimary({
				type: 'save-file',
				id: current.id,
				label: displayName(current),
				dirty: opening.state.dirty
			});
			chooseTarget({ kind: 'save-file', id: current.id }, false);
			summonedWorkflow.closeAll();
			menuSaveFileId = null;
			menuReturnTarget = null;
			const path =
				destination === 'boxes'
					? resolve('/boxes')
					: destination === 'trainer'
						? resolve('/trainer')
						: resolve('/bag');
			try {
				await storage.recordSuccessfulOpen(current.id);
				invalidateSavesCache();
			} catch (error) {
				toastHost.error(
					'Opened Save File, but could not store its recently opened history. ' +
						getErrorMessage(error)
				);
			}
			await goto(path, {
				keepFocus: true
			});
		} catch (error) {
			toastHost.error('Could not open Save File. ' + getErrorMessage(error));
			if (menuOpen) void focusMenuCommand(menuIndex);
			else void focusGrid();
		} finally {
			busyTarget = null;
		}
	}

	function openSaveFileMenu(saveFileId: SaveFileId) {
		if (busyTarget || !saveFiles.some((saveFile) => saveFile.id === saveFileId)) return;
		if (
			!summonedWorkflow.open('save-file-menu', {
				type: 'control',
				id: gridElement?.id ?? 'saves-grid'
			})
		) {
			return;
		}
		menuSaveFileId = saveFileId;
		menuReturnTarget = target;
		menuIndex = 0;
		replaceEdits = false;
		deleteDescription = null;
		void focusMenuCommand(0);
	}

	function openBackups() {
		const owner = menuSaveFile;
		if (!owner || busyTarget) return;
		chooseTarget({ kind: 'save-file', id: owner.id }, false);
		summonedWorkflow.closeAll();
		summonedWorkflow.open(
			'backup-browser',
			{ type: 'control', id: gridElement?.id ?? 'saves-grid' },
			owner
		);
		menuSaveFileId = null;
		menuReturnTarget = null;
	}

	async function requestDelete() {
		const saveFile = menuSaveFile;
		const launchingWorkflow = summonedWorkflow.active;
		if (!saveFile || busyTarget || launchingWorkflow?.kind !== 'save-file-menu') return;
		try {
			const current = await storage.getSave(saveFile.id);
			if (summonedWorkflow.active !== launchingWorkflow || menuSaveFileId !== saveFile.id) return;
			if (!current) throw new Error('The selected Save File is no longer available.');
			const cachedWorkspace = getCachedActiveWorkspace();
			const persistedWorkspace =
				cachedWorkspace?.file.id === current.id
					? cachedWorkspace
					: await storage.getWorkspace(current.id);
			if (summonedWorkflow.active !== launchingWorkflow || menuSaveFileId !== saveFile.id) return;
			deleteDescription = deletionWarning(
				current,
				current.id === activeSaveFileId,
				persistedWorkspace?.dirty === true
			);
			summonedWorkflow.openRelated('save-file-delete', {
				type: 'control',
				id: 'save-file-menu-command-2'
			});
			menuIndex = 0;
			void focusMenuCommand(0);
		} catch (error) {
			if (summonedWorkflow.active !== launchingWorkflow || menuSaveFileId !== saveFile.id) return;
			toastHost.error(getErrorMessage(error));
		}
	}

	function deletionWarning(saveFile: StoredSaveFile, active: boolean, dirty: boolean) {
		const parts = [
			'This removes ' + displayName(saveFile) + ' and all of its Backups from this device.'
		];
		if (active) parts.push('Its active Workspace will also be removed.');
		if (dirty) parts.push('The Dirty Workspace contains unexported changes, which will be lost.');
		parts.push('This cannot be undone.');
		return parts.join(' ');
	}

	async function confirmDelete() {
		const saveFile = menuSaveFile;
		if (!saveFile || busyTarget) return;
		const preDeleteTargets = currentTargets();
		const fallback = deleteSavesTarget(preDeleteTargets, {
			kind: 'save-file',
			id: saveFile.id
		});
		busyTarget = saveFile.id;
		try {
			if (!(await storage.getSave(saveFile.id))) {
				throw new Error('The selected Save File is no longer available.');
			}
			if (await recoveryBackupId(saveFile)) throw new Error('Restore the emulator file first.');
			await getSaveFileEditCoordinator().deleteSave(saveFile);
			discovery.forget(saveFile);
			invalidateSavesCache();
			invalidateActiveWorkspaceCache(saveFile.id);
			summonedWorkflow.closeAll();
			menuSaveFileId = null;
			menuReturnTarget = null;
			deleteDescription = null;
			await refreshSaves({ force: true, preferredTarget: fallback, focus: true });
			toastHost.success(displayName(saveFile) + ' deleted.');
		} catch (error) {
			toastHost.error('Could not delete Save File. ' + getErrorMessage(error));
			void focusMenuCommand(menuIndex);
		} finally {
			busyTarget = null;
		}
	}

	function handleMenuKeydown(event: KeyboardEvent) {
		if (
			!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(
				event.key
			)
		) {
			return;
		}
		event.preventDefault();
		if (event.key === 'Escape') {
			dismissSaveFileWorkflow();
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			if (deleteOpen) {
				if (menuIndex === 0) cancelDelete();
				else void confirmDelete();
			} else if (menuOpen) {
				if (menuIndex === 0 && menuSaveFile) void activateSaveFile(menuSaveFile, 'trainer');
				else if (menuIndex === 1 && menuSaveFile) void activateSaveFile(menuSaveFile, 'bag');
				else if (menuIndex === 3) openBackups();
				else if (menuIndex === 4) void runSourceAction();
				else if (menuIndex === 5) requestRename();
				else if (menuIndex === 6) void hideSave();
				else void requestDelete();
			}
			return;
		}
		const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
		menuIndex = Math.max(
			0,
			Math.min(
				deleteOpen ? 1 : 6,
				!deleteOpen && !menuSource && menuIndex + offset === 4
					? offset > 0
						? 5
						: 3
					: menuIndex + offset
			)
		);
		void focusMenuCommand(menuIndex);
	}

	async function runSourceAction() {
		const source = menuSource;
		if (!source || discovery.sourceBusy) return;
		if (source.kind === 'recovery') {
			dismissSaveFileWorkflow();
			return discovery.recoverSource(source);
		}
		if (source.localChanges && !replaceEdits) {
			replaceEdits = true;
			return;
		}
		if (await discovery.loadExternal(source, replaceEdits)) dismissSaveFileWorkflow();
		else replaceEdits = true;
	}

	function dismissSaveFileWorkflow() {
		if (busyTarget) return;
		if (deleteOpen) {
			cancelDelete();
			return;
		}
		if (!menuOpen) return;
		const returnTarget = menuReturnTarget;
		summonedWorkflow.dismiss();
		menuSaveFileId = null;
		menuReturnTarget = null;
		deleteDescription = null;
		chooseTarget(resolveSavesTarget(targets, returnTarget, activeSaveFileId));
	}

	function cancelDelete() {
		if (busyTarget || !deleteOpen) return;
		summonedWorkflow.dismiss();
		deleteDescription = null;
		menuIndex = 2;
		void focusMenuCommand(2);
	}

	async function focusMenuCommand(index: number) {
		await tick();
		const prefix = deleteOpen ? 'save-file-delete-command-' : 'save-file-menu-command-';
		document.getElementById(prefix + index)?.focus();
	}

	const linkedCounts = $derived(
		saveFiles.reduce<Record<string, number>>((counts, file) => {
			const tree = folderOf(file.linkedDocumentId, discovery.folders)?.tree;
			if (tree) counts[tree] = (counts[tree] ?? 0) + 1;
			return counts;
		}, {})
	);

	function sourceLabel(saveFile: StoredSaveFile) {
		const emulator = fileEmulator(saveFile);
		const folder = folderOf(saveFile.linkedDocumentId, discovery.folders)?.name;
		if (!folder) return emulator;
		return emulator && !folder.toLowerCase().includes(emulator.toLowerCase())
			? `${emulator} · ${folder}`
			: folder;
	}

	function requestRename() {
		if (busyTarget || !menuSaveFile) return;
		summonedWorkflow.openRelated('save-file-rename', {
			type: 'control',
			id: 'save-file-menu-command-5'
		});
	}

	async function applyRename(name: string | null) {
		if (!menuSaveFile || busyTarget) return;
		const id = menuSaveFile.id;
		busyTarget = id;
		try {
			const file = await storage.renameSave(id, name);
			const workspace = getCachedActiveWorkspace();
			if (workspace?.file.id === id) {
				setCachedActiveWorkspace({ ...workspace, file }, getCachedActiveWorkspaceBox());
			}
			invalidateSavesCache();
			summonedWorkflow.closeAll();
			menuSaveFileId = null;
			menuReturnTarget = null;
			await refreshSaves({ force: true, preferredTarget: { kind: 'save-file', id }, focus: true });
		} catch (error) {
			toastHost.error(getErrorMessage(error));
		} finally {
			busyTarget = null;
		}
	}

	function cancelRename() {
		if (busyTarget) return;
		summonedWorkflow.dismiss();
		menuIndex = 5;
		void focusMenuCommand(5);
	}

	async function setHidden(file: StoredSaveFile, hidden: boolean, preferredTarget: SavesTarget) {
		busyTarget = file.id;
		try {
			const updated = await storage.setSaveHidden(file.id, hidden);
			const workspace = getCachedActiveWorkspace();
			if (workspace?.file.id === file.id) {
				setCachedActiveWorkspace({ ...workspace, file: updated }, getCachedActiveWorkspaceBox());
			}
			invalidateSavesCache();
			summonedWorkflow.closeAll();
			menuSaveFileId = null;
			menuReturnTarget = null;
			await refreshSaves({ force: true, preferredTarget, focus: true });
			return true;
		} catch (error) {
			toastHost.error(getErrorMessage(error));
			return false;
		} finally {
			busyTarget = null;
		}
	}

	async function hideSave() {
		const file = menuSaveFile;
		if (!file || busyTarget) return;
		const fallback = deleteSavesTarget(currentTargets(), { kind: 'save-file', id: file.id });
		if (await setHidden(file, true, fallback)) {
			toastHost.success(displayName(file) + ' hidden. Find it in Hidden saves.');
		}
	}

	async function unhideSave(file: StoredSaveFile) {
		if (busyTarget) return;
		const restored = { ...file, hidden: false };
		if (!filterSortSaves({ files: [restored], details: detailsBySaveFileId, query, sort }).length) {
			query = '';
		}
		await setHidden(file, false, { kind: 'save-file', id: file.id });
	}

	function openHiddenSaves() {
		if (busyTarget) return;
		summonedWorkflow.open('hidden-saves-menu', { type: 'control', id: 'saves-hidden' });
	}

	async function closeHiddenSaves() {
		if (busyTarget) return;
		summonedWorkflow.dismiss();
		await tick();
		document.getElementById('saves-hidden')?.focus();
	}

	function updateLibrary(nextQuery = query, nextSort = sort) {
		query = nextQuery;
		sort = nextSort;
		target = resolveSavesTarget(
			currentTargets(
				filterSortSaves({ files: saveFiles, details: detailsBySaveFileId, query, sort })
			),
			target,
			null
		);
		rememberTarget(target);
	}

	function chooseSort(next: SavesSort) {
		if (next === sort) return;
		updateLibrary(query, next);
		writeSavesSort(next);
	}

	function clearSearch() {
		document.getElementById('saves-search')?.focus();
		updateLibrary('');
	}

	function libraryControls() {
		const field = searchControls.querySelector<HTMLInputElement>('input')!;
		const sortGroup = searchControls.querySelector<HTMLElement>('.sort-toggle')!;
		return {
			field,
			sortGroup,
			hiddenToggle: searchControls.querySelector<HTMLElement>('.hidden-toggle')!,
			stacked: sortGroup.getBoundingClientRect().bottom <= field.getBoundingClientRect().top
		};
	}

	function handleSearchFocus(event: FocusEvent) {
		const direction = tabDirection;
		tabDirection = null;
		if (
			!direction ||
			(event.relatedTarget instanceof Node && searchControls.contains(event.relatedTarget))
		)
			return;
		const { field, sortGroup, hiddenToggle, stacked } = libraryControls();
		if (!stacked) return;
		const buttons = sortGroup.querySelectorAll<HTMLButtonElement>('button');
		if (direction === 'forward' && event.target === field) buttons[0]?.focus();
		else if (direction === 'backward' && (event.target === buttons[1] || event.target === field))
			hiddenToggle.focus();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		const active = document.activeElement;
		const { field, sortGroup, hiddenToggle, stacked } = libraryControls();
		const inSort = sortGroup.contains(active);
		if (event.key === 'Tab' && stacked) {
			const clear = searchControls.querySelector<HTMLButtonElement>('.search-clear');
			const controls = [
				...sortGroup.querySelectorAll<HTMLElement>('button'),
				field,
				...(clear ? [clear] : []),
				hiddenToggle
			];
			const index = controls.findIndex((node) => node === active);
			const next = controls[index + (event.shiftKey ? -1 : 1)];
			if (next) {
				event.preventDefault();
				next.focus();
			} else if (!event.shiftKey) {
				event.preventDefault();
				void focusGrid();
			} else field.focus();
			return;
		}
		if (event.key === 'ArrowDown' && stacked && inSort) {
			event.preventDefault();
			field.focus();
		} else if (event.key === 'Escape' || event.key === 'ArrowDown') {
			event.preventDefault();
			void focusGrid();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (stacked && !inSort) {
				sortGroup.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
			}
		} else if (
			(event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
			!(active instanceof HTMLInputElement && !isControllerKeyboardEvent(event))
		) {
			event.preventDefault();
			const controls = Array.from(searchControls.querySelectorAll<HTMLElement>('input, button'));
			if (stacked) {
				controls.sort((a, b) => Number(sortGroup.contains(b)) - Number(sortGroup.contains(a)));
			}
			const index = controls.findIndex((node) => node === active);
			controls[
				Math.max(0, Math.min(controls.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))
			]?.focus();
		}
	}

	function displayName(saveFile: StoredSaveFile) {
		return getSaveDisplayName(saveFile);
	}

	function gameTitle(details: SaveCardDetailsState, saveFile: StoredSaveFile) {
		if (details.status !== 'ready') return displayName(saveFile);
		return getSaveGameTitle(details.details.summary.gameVersion);
	}

	function getErrorMessage(error: unknown) {
		if (isEngineError(error)) return error.message;
		if (error instanceof Error && error.message) return error.message;
		return 'PKSX could not complete the operation.';
	}

	function isEngineError(error: unknown): error is EngineError {
		return (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			'message' in error &&
			typeof error.message === 'string'
		);
	}
</script>

<svelte:window onkeydown={handleKeydown} onpointerdown={() => (tabDirection = null)} />

<section
	class="saves-route pksx-density-container"
	aria-labelledby="saves-title"
	data-destination-root="saves"
	data-initial-state={catalogLoading ? 'loading' : 'ready'}
	inert={summonedWorkflow.active !== null}
>
	<div class="saves-density pksx-density">
		<header class="library-bar">
			<div class="library-title">
				<h1 id="saves-title">Saves</h1>
				<p class="library-count" role="status" style:--count-digits={String(libraryCount).length}>
					{#if searching}
						{visibleSaveFiles.length} of {libraryCount}<span class="sr-only">
							Save Files match</span
						>
					{:else if !catalogLoading && libraryCount > 0}
						{libraryCount}<span class="count-unit"
							>{libraryCount === 1 ? ' Save File' : ' Save Files'}</span
						>
					{/if}
				</p>
			</div>
			<div
				class="library-tools"
				onfocusin={handleSearchFocus}
				{@attach (node) => {
					searchControls = node;
				}}
			>
				<div class="search-field" role="search">
					<label class="sr-only" for="saves-search">Search Saves</label>
					<svg class="search-icon" viewBox="0 0 16 16" aria-hidden="true">
						<circle cx="7" cy="7" r="4.5" />
						<path d="m10.5 10.5 3.5 3.5" />
					</svg>
					<input
						id="saves-search"
						type="search"
						value={query}
						placeholder="Name, game or trainer"
						autocomplete="off"
						oninput={(event) => updateLibrary(event.currentTarget.value)}
					/>
					{#if query}
						<button
							type="button"
							class="search-clear"
							data-pksx-control-category="small"
							aria-label="Clear search"
							onclick={clearSearch}
						>
							<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
						</button>
					{/if}
				</div>
				<button
					id="saves-hidden"
					type="button"
					class="hidden-toggle"
					aria-label={'Show hidden saves' +
						(hiddenSaveFiles.length ? ', ' + hiddenSaveFiles.length + ' hidden' : '')}
					onclick={openHiddenSaves}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
						<path d="m2.5 13.5 11-11" />
					</svg>
					{#if hiddenSaveFiles.length}<span aria-hidden="true">{hiddenSaveFiles.length}</span>{/if}
				</button>
				<div class="sort-toggle" role="group" aria-label="Sort">
					<button
						type="button"
						aria-pressed={sort === 'alphabetical'}
						onclick={() => chooseSort('alphabetical')}
					>
						<span aria-hidden="true">A–Z</span><span class="sr-only">A to Z</span>
					</button>
					<button
						type="button"
						aria-pressed={sort === 'recently-opened'}
						onclick={() => chooseSort('recently-opened')}>Recent</button
					>
				</div>
			</div>
			<input
				id="save-file-input"
				tabindex="-1"
				data-pksx-control-category="composition"
				type="file"
				aria-label="Import Save File"
				disabled={busyTarget !== null}
				onchange={handleImport}
				oncancel={handleImportCancel}
			/>
			<input
				id="storage-backup-input"
				tabindex="-1"
				data-pksx-control-category="composition"
				type="file"
				accept=".pksx-storage"
				aria-label="Choose Pokemon Storage backup"
				onchange={handleStorageArchive}
			/>
		</header>

		<div class="saves-scrollport">
			{#if searching && visibleSaveFiles.length === 0}
				<p class="no-matches">
					No name, game, trainer or filename contains <strong>“{query.trim()}”</strong>.
				</p>
			{:else if !catalogLoading && libraryCount === 0 && hiddenSaveFiles.length > 0}
				<p class="no-matches">
					Every Save File is hidden. Choose <strong>Show hidden saves</strong> to open or unhide one.
				</p>
			{/if}
			<div
				id="saves-grid"
				{@attach savesGridOwner}
				class="saves-collections"
				role="grid"
				tabindex="0"
				aria-label="Saves collections"
				aria-rowcount={rowCount}
				aria-colcount={columnCount}
				aria-activedescendant={activeTargetId}
				aria-busy={catalogLoading || busyTarget !== null}
				data-destination-focus="saves-grid"
				data-destination-initial
				onfocus={() => void scrollTargetIntoView()}
			>
				<div class="saves-grid" {@attach savesGridContent}>
					{#each gridRows as row, rowIndex (gridRowKey(row))}
						<div class="saves-grid-row" role="row" aria-rowindex={rowIndex + 1}>
							{#each row as entry (entry.kind === 'save-file' ? entry.saveFile.id : entry.kind)}
								{#if entry.kind === 'save-file'}
									{@const saveFile = entry.saveFile}
									{@const index = entry.index}
									{@const details = detailsBySaveFileId[saveFile.id] ?? { status: 'loading' }}
									{@const selected = sameSavesTarget(target, {
										kind: 'save-file',
										id: saveFile.id
									})}
									<div
										id={targetDomId({ kind: 'save-file', id: saveFile.id })}
										class={[
											'save-card',
											selected && 'controller-focused',
											saveFile.id === activeSaveFileId && 'active'
										]}
										role="gridcell"
										aria-colindex={(index % columnCount) + 1}
										aria-current={saveFile.id === activeSaveFileId ? 'true' : undefined}
										aria-busy={busyTarget === saveFile.id || details.status === 'loading'}
										in:cardRise={{ index }}
									>
										<button
											type="button"
											class="card-main"
											data-pksx-control-category="card"
											tabindex="-1"
											aria-label={'Open ' + displayName(saveFile) + ' in Boxes'}
											onpointerdown={(event) => event.preventDefault()}
											onclick={() => {
												chooseTarget({ kind: 'save-file', id: saveFile.id }, false);
												void activateSaveFile(saveFile, 'boxes');
											}}
										>
											<span class="card-heading">
												<strong>{gameTitle(details, saveFile)}</strong>
												{#if saveFile.id === activeSaveFileId}<em>Active</em>{/if}
												{#if discovery.sources[saveFile.id]}<em class="attention"
														>{discovery.sources[saveFile.id].kind === 'changed'
															? 'Updated'
															: 'Restore'}</em
													>{/if}
											</span>
											{#if details.status === 'ready'}
												<span class="trainer"
													>{details.details.summary.trainerName ?? 'Unknown Trainer'}</span
												>
												<span
													class="file-name"
													title={saveFile.originalFileName ?? undefined}
													elementtiming="save-card">{displayName(saveFile)}</span
												>
												{#if sourceLabel(saveFile)}<span class="file-name source"
														>{sourceLabel(saveFile)}</span
													>{/if}
												{#if saveFile.displayName}<span class="file-name"
														>{saveFile.originalFileName ?? 'No original filename'}</span
													>{/if}
												<span class="card-stats">
													<b>{details.details.summary.boxCount}</b> boxes
													<i aria-hidden="true"></i>
													<b>{details.details.pokemonCount}</b> Pokemon
												</span>
											{:else}
												<span
													class="file-name"
													title={saveFile.originalFileName ?? undefined}
													elementtiming="save-card">{displayName(saveFile)}</span
												>
												{#if sourceLabel(saveFile)}<span class="file-name source"
														>{sourceLabel(saveFile)}</span
													>{/if}
												<span class="detail-state">
													{#if details.status === 'loading'}
														<DelayedSpinner active label={`Reading ${displayName(saveFile)}`} />
													{:else}
														Details unavailable
													{/if}
												</span>
											{/if}
										</button>
										<button
											type="button"
											class="save-menu-control"
											data-pksx-control-category="small"
											aria-label={'Open Save File Menu for ' + displayName(saveFile)}
											onpointerdown={(event) => event.preventDefault()}
											onclick={() => openSaveFileMenu(saveFile.id)}
										>
											•••
										</button>
										<DelayedSpinner
											active={busyTarget === saveFile.id}
											label={`Opening ${displayName(saveFile)}`}
										/>
									</div>
								{:else if entry.kind === 'pokemon-storage'}
									{@const selected = target.kind === 'pokemon-storage'}
									<div
										id="saves-target-pokemon-storage"
										class={['storage-card', selected && 'controller-focused']}
										role="gridcell"
										aria-colindex={(entry.index % columnCount) + 1}
										in:cardRise={{ index: entry.index }}
									>
										<button
											type="button"
											class="card-main storage-main"
											data-pksx-control-category="card"
											tabindex="-1"
											aria-label="Open Pokemon Storage in Boxes"
											onpointerdown={(event) => event.preventDefault()}
											onclick={() => void openPokemonStorage()}
										>
											<span class="card-heading"><strong>Pokemon Storage</strong></span>
											<span class="storage-persistence">Automatically saved by PKSX</span>
											<span class="card-stats">
												<b>{pokemonStorage.pokemonCount}</b> Pokemon
												<i aria-hidden="true"></i>
												<b>{pokemonStorage.boxCount}</b> Storage
												{pokemonStorage.boxCount === 1 ? 'Box' : 'Boxes'}
											</span>
										</button>
										<button
											type="button"
											class="save-menu-control"
											data-pksx-control-category="small"
											aria-label="Open Pokemon Storage Backup Menu"
											onpointerdown={(event) => event.preventDefault()}
											onclick={() => void openStorageBackupMenu()}>•••</button
										>
									</div>
								{:else}
									<div
										id="saves-target-import"
										class={['import-cell', target.kind === 'import' && 'controller-focused']}
										role="gridcell"
										aria-colindex={(entry.index % columnCount) + 1}
										aria-busy={busyTarget === 'import'}
										in:cardRise={{ index: entry.index }}
									>
										<button
											type="button"
											data-pksx-control-category="card"
											tabindex="-1"
											aria-label={folderLinking ? 'Add saves' : 'Import a Save File'}
											onpointerdown={(event) => event.preventDefault()}
											onclick={openAddSaves}
										>
											<span>+</span>
											<strong>{folderLinking ? 'Add saves' : 'Import a Save File'}</strong>
											<DelayedSpinner
												active={busyTarget === 'import' || discovery.scanning}
												label={discovery.scanning ? 'Finding saves' : 'Importing Save File'}
											/>
											<small
												>{folderLinking
													? 'Link an emulator or import a file'
													: 'Choose a compatible file from this device.'}</small
											>
										</button>
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>
			<SavesIntroduction compact={saveFiles.length > 0 || pokemonStorage.pokemonCount > 0} />
		</div>
	</div>
</section>

{#if (menuOpen || deleteOpen) && menuSaveFile}
	<SaveFileMenu
		mode={deleteOpen ? 'delete' : 'commands'}
		fileName={displayName(menuSaveFile)}
		description={deleteOpen
			? (deleteDescription ?? undefined)
			: (menuSaveFile.originalFileName ?? undefined)}
		activeIndex={menuIndex}
		busy={busyTarget === menuSaveFile.id}
		onFocusCommand={(index) => (menuIndex = index)}
		onOpenTrainer={() => void activateSaveFile(menuSaveFile, 'trainer')}
		onOpenBag={() => void activateSaveFile(menuSaveFile, 'bag')}
		onBackups={openBackups}
		sourceAction={menuSource
			? replaceEdits
				? 'Replace your edits?'
				: (menuSource.kind === 'changed' ? 'Load from ' : 'Restore file in ') +
					(fileEmulator(menuSaveFile) ?? 'emulator')
			: undefined}
		onSourceAction={() => void runSourceAction()}
		onRename={requestRename}
		onHide={() => void hideSave()}
		onDelete={() => (deleteOpen ? void confirmDelete() : void requestDelete())}
		onCancelDelete={cancelDelete}
		onClose={dismissSaveFileWorkflow}
	/>
{/if}

{#if addSavesOpen}
	<AddSavesMenu
		folders={discovery.folders}
		counts={linkedCounts}
		failed={discovery.failed}
		scanning={discovery.scanning}
		busy={discovery.picking || discovery.sourceBusy}
		onLink={() => closeAddSaves(() => void discovery.link())}
		onImport={() => closeAddSaves(openImportPicker)}
		onScan={() => (discovery.scanning ? discovery.cancel() : void discovery.scan(undefined, true))}
		onUnlink={(folder) => void discovery.unlink(folder)}
		onClose={() => closeAddSaves()}
	/>
{/if}

{#if hiddenSavesOpen}
	<HiddenSavesMenu
		files={hiddenSaveFiles}
		busy={busyTarget !== null}
		onUnhide={(file) => void unhideSave(file)}
		onOpen={(file) => void activateSaveFile(file, 'boxes')}
		onClose={() => void closeHiddenSaves()}
	/>
{/if}

{#if renameOpen && menuSaveFile}
	<RenameSaveFile
		file={menuSaveFile}
		busy={busyTarget !== null}
		onApply={applyRename}
		onCancel={cancelRename}
	/>
{/if}

{#if storageBackupOpen || storageConfirmOpen}
	<StorageBackupMenu
		confirmation={storageConfirmOpen ? storageConfirmation : null}
		canRecover={storageRecoveryAvailable}
		activeIndex={storageBackupIndex}
		busy={busyTarget === 'pokemon-storage'}
		onFocusCommand={(index) => (storageBackupIndex = index)}
		onExport={() => void exportStorageBackup()}
		onRestore={() => document.getElementById('storage-backup-input')?.click()}
		onRecover={() => void requestStorageRecovery()}
		onConfirm={() => void confirmStorageReplacement()}
		onClose={dismissStorageBackup}
	/>
{/if}

<style>
	.library-bar {
		min-height: var(--pksx-control-height);
		display: grid;
		grid-template-columns: minmax(max-content, 1fr) minmax(8rem, 22rem) auto auto;
		grid-template-areas: 'title search hidden sort';
		align-items: center;
		gap: var(--pksx-space-2);
	}

	.library-title {
		grid-area: title;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: var(--pksx-space-2);
		padding-inline-end: var(--pksx-space-2);
	}

	.library-title h1,
	.library-count {
		margin: 0;
	}

	.library-title h1 {
		font-size: var(--pksx-type-display);
		line-height: 1;
	}

	.library-count {
		/* Room for "N Save Files" plus slack, so the search field does not move. */
		min-width: calc((var(--count-digits) + 11.5) * 1ch);
		overflow: hidden;
		color: var(--ink-soft);
		font: 650 var(--pksx-type-label) / 1.2 var(--pksx-font-mono);
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.library-tools {
		display: contents;
	}

	.search-field {
		grid-area: search;
		position: relative;
		min-width: 0;
	}

	.search-icon,
	.search-clear svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.search-icon {
		position: absolute;
		inset-block: 0;
		left: var(--pksx-space-2);
		width: var(--pksx-icon-size);
		height: var(--pksx-icon-size);
		margin-block: auto;
		color: var(--ink-soft);
		pointer-events: none;
	}

	.search-field input {
		width: 100%;
		min-height: var(--pksx-control-height);
		padding: 0 calc(var(--pksx-small-control-height) + var(--pksx-space-2)) 0
			calc(var(--pksx-icon-size) + var(--pksx-space-2) * 2);
		border: var(--pksx-border-width) solid var(--ink-soft);
		border-radius: var(--pksx-radius-medium);
		background: var(--paper-hi);
		color: var(--ink);
		caret-color: var(--rust);
		font-size: var(--pksx-type-editable);
		line-height: 1.2;
		text-overflow: ellipsis;
	}

	.search-field input::placeholder {
		color: var(--ink-soft);
		opacity: 1;
	}

	.search-field input::selection {
		background: var(--rust-ring);
		color: var(--ink);
	}

	.search-field input::-webkit-search-cancel-button {
		display: none;
	}

	.search-field input:hover {
		border-color: var(--ink);
	}

	.search-field input:focus {
		border-color: var(--rust);
		outline: var(--pksx-focus-ring) solid var(--rust-ring);
		outline-offset: 0;
		box-shadow: none;
	}

	.search-clear {
		position: absolute;
		inset-block: 0;
		right: var(--pksx-space-1);
		width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		margin-block: auto;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: var(--pksx-radius-small);
		background: transparent;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.search-clear svg {
		width: var(--pksx-small-icon-size);
		height: var(--pksx-small-icon-size);
	}

	.search-clear:hover,
	.search-clear:active {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.sort-toggle {
		grid-area: sort;
		/* Keeps the bar clear of the fixed Main Menu button. */
		margin-inline-end: max(
			0px,
			calc(var(--pksx-control-height) + var(--pksx-space-1) - max(0px, 50cqw - 600px))
		);
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		border-radius: var(--pksx-radius-medium);
		background: var(--paper-deep);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
	}

	.sort-toggle button {
		min-height: var(--pksx-control-height);
		padding: 0 calc(var(--pksx-space-1) + 6px);
		border: 2px solid transparent;
		border-radius: var(--pksx-radius-medium);
		background: transparent padding-box;
		color: var(--ink-soft);
		font: 700 var(--pksx-type-label) / 1 var(--pksx-font-sans);
		white-space: nowrap;
		cursor: pointer;
	}

	.sort-toggle button:hover {
		color: var(--ink);
	}

	.sort-toggle button:active {
		background-color: var(--rust-wash);
	}

	.sort-toggle button[aria-pressed='true'] {
		background-color: var(--paper-hi);
		color: var(--rust);
		color: color-mix(in srgb, var(--rust), var(--ink) 25%);
	}

	.hidden-toggle {
		grid-area: hidden;
		min-width: var(--pksx-control-height);
		min-height: var(--pksx-control-height);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--pksx-space-1);
		padding: 0 var(--pksx-space-2);
		border: 0;
		border-radius: var(--pksx-radius-medium);
		background: var(--paper-deep);
		box-shadow: inset 0 0 0 var(--pksx-border-width) var(--rule);
		color: var(--ink-soft);
		font: 700 var(--pksx-type-label) / 1 var(--pksx-font-mono);
		cursor: pointer;
	}

	.hidden-toggle svg {
		width: var(--pksx-icon-size);
		height: var(--pksx-icon-size);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	.hidden-toggle:hover {
		color: var(--ink);
	}

	.hidden-toggle:active {
		background-color: var(--rust-wash);
	}

	.search-clear:focus-visible,
	.hidden-toggle:focus-visible,
	.sort-toggle button:focus-visible {
		outline: var(--pksx-focus-ring) solid var(--rust);
		outline-offset: 0;
	}

	.no-matches {
		margin: 0 0 var(--pksx-space-2);
		color: var(--ink-soft);
		font-size: var(--pksx-type-body);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.no-matches strong {
		color: var(--ink);
	}

	@container pksx-density (max-width: 559px) {
		.library-bar {
			grid-template-columns: minmax(0, 1fr) auto auto;
			grid-template-areas:
				'title sort sort'
				'search search hidden';
		}

		.library-count {
			min-width: 0;
		}

		.count-unit {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	:global(.app-shell:has(.saves-route)) {
		height: 100dvh;
		min-height: 100dvh;
		overflow: hidden;
	}

	.saves-route {
		min-width: 0;
		min-height: 0;
		flex: 1 1 0;
		overflow: hidden;
	}

	.saves-density {
		width: min(1200px, 100%);
		height: 100%;
		min-height: 0;
		margin: 0 auto;
		padding: var(--pksx-space-2);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: var(--pksx-space-2);
	}

	#save-file-input,
	#storage-backup-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.saves-scrollport {
		min-width: 0;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}

	.saves-collections:focus {
		outline: none;
	}

	.saves-grid {
		display: grid;
		grid-template-columns: minmax(240px, 1fr);
		gap: var(--pksx-space-2);
		align-content: start;
	}

	.saves-grid-row {
		display: contents;
	}

	.save-card,
	.storage-card,
	.import-cell {
		position: relative;
		min-width: 240px;
		min-height: 112px;
		border: var(--pksx-border-width) solid var(--rule);
		border-radius: var(--pksx-radius-small) var(--pksx-radius-large) var(--pksx-radius-large)
			var(--pksx-radius-small);
		background: var(--paper-hi);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.save-card.active {
		border-color: color-mix(in srgb, var(--rust), transparent 25%);
		background:
			linear-gradient(color-mix(in srgb, var(--rust-wash), transparent 38%), transparent 80%),
			var(--paper-hi);
	}

	.storage-card {
		border-color: color-mix(in srgb, var(--ok), var(--rule) 38%);
		background:
			linear-gradient(color-mix(in srgb, var(--ok), transparent 90%), transparent 82%),
			var(--paper-hi);
	}

	.save-card.controller-focused,
	.storage-card.controller-focused,
	.import-cell.controller-focused {
		outline: var(--pksx-focus-ring) solid var(--rust-ring);
		outline-offset: calc(-1 * var(--pksx-focus-ring));
	}

	.card-main,
	.import-cell > button {
		width: 100%;
		min-height: 110px;
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.card-main {
		padding: var(--pksx-space-2) calc(var(--pksx-control-height) + var(--pksx-space-2))
			var(--pksx-space-2) var(--pksx-space-3);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-rows: auto auto auto 1fr;
		gap: 2px var(--pksx-space-2);
		text-align: left;
	}

	.card-main.storage-main {
		padding-right: calc(var(--pksx-control-height) + var(--pksx-space-2));
	}

	@media (hover: hover) {
		.card-main:hover,
		.import-cell > button:hover {
			background: var(--rust-wash);
		}
	}

	.save-card > :global(.delayed-spinner.visible) {
		position: absolute;
		right: var(--pksx-space-2);
		bottom: var(--pksx-space-2);
	}

	.card-heading {
		grid-column: 1 / -1;
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--pksx-space-2);
	}

	.card-heading strong {
		overflow: hidden;
		font-size: var(--pksx-type-title);
		line-height: 1.1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-heading em.attention {
		background: var(--ink);
	}

	.card-heading em {
		flex: 0 0 auto;
		padding: 3px 6px;
		border-radius: var(--pksx-radius-small);
		background: var(--rust);
		color: var(--pksx-color-on-accent);
		font: 750 var(--pksx-type-label) / 1 var(--pksx-font-sans);
		font-style: normal;
	}

	.trainer {
		color: var(--ink-soft);
		font: 700 var(--pksx-type-label) / 1.2 var(--pksx-font-sans);
	}

	.file-name,
	.card-stats,
	.detail-state,
	.storage-persistence {
		grid-column: 1 / -1;
		color: var(--ink-soft);
		font: 600 var(--pksx-type-label) / 1.25 var(--pksx-font-sans);
	}

	.source::before {
		content: '⇄ ' / '';
	}

	.file-name {
		font-family: var(--pksx-font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-stats,
	.detail-state {
		align-self: end;
		padding-top: var(--pksx-space-1);
		border-top: var(--pksx-border-width) solid var(--rule);
	}

	.card-stats b {
		color: var(--ink);
	}

	.card-stats i {
		display: inline-block;
		width: 3px;
		height: 3px;
		margin: 0 5px 2px;
		border-radius: 50%;
		background: var(--rust);
	}

	.save-menu-control {
		position: absolute;
		top: var(--pksx-space-2);
		right: var(--pksx-space-2);
		min-width: var(--pksx-small-control-height);
		height: var(--pksx-small-control-height);
		padding: 0 7px;
		border: 0;
		border-radius: var(--pksx-radius-small);
		background: var(--paper-deep);
		color: var(--ink-soft);
		font: 800 var(--pksx-type-label) / 1 var(--pksx-font-mono);
		cursor: pointer;
	}

	.save-menu-control:hover,
	.save-menu-control:focus-visible {
		background: var(--rust-wash);
		color: var(--rust);
	}

	.import-cell {
		border-style: dashed;
		border-radius: var(--pksx-radius-large);
		box-shadow: none;
	}

	.import-cell > button {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 3px;
		padding: var(--pksx-space-2);
		text-align: center;
	}

	.import-cell span {
		font-size: var(--pksx-type-display);
		line-height: 1;
	}

	.import-cell strong {
		font-size: var(--pksx-type-label);
	}

	.import-cell small {
		color: var(--ink-soft);
		font: 600 var(--pksx-type-label) / 1.25 var(--pksx-font-sans);
	}

	@container pksx-density (min-width: 520px) {
		.saves-grid {
			grid-template-columns: repeat(2, minmax(240px, 1fr));
		}
	}

	@container pksx-density (min-width: 780px) {
		.saves-grid {
			grid-template-columns: repeat(3, minmax(240px, 1fr));
		}
	}

	@container pksx-density (min-width: 1040px) {
		.saves-grid {
			grid-template-columns: repeat(4, minmax(240px, 1fr));
		}
	}
</style>
