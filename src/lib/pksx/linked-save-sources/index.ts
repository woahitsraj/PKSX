import { registerPlugin } from '@capacitor/core';
import { z } from 'zod';
import type { EngineApi } from '$lib/engine';
import { bytesEqual, type SavesStorage, type StoredSaveFile } from '$lib/pksx/saves';
import { createPersistedWorkspaceState } from '$lib/pksx/backup-workflow';
import type { SaveFileEditCoordinator } from '$lib/pksx/save-file-edit-coordinator';
import { documentBytes } from '$lib/pksx/linked-save-folders';

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const pendingSchema = z.object({
	beforeHash: hashSchema,
	afterHash: hashSchema,
	backupId: z.string(),
	recoveryBackupId: z.string(),
	recoveryHash: hashSchema
});
const inspectionSchema = z.object({
	source: z.object({
		saveFileId: z.string(),
		baselineHash: hashSchema,
		pending: pendingSchema.optional()
	}),
	hash: hashSchema,
	name: z.string(),
	base64: z.string(),
	outcome: z.enum(['none', 'completed', 'not-written', 'recovery-required'])
});
export type SourceInspection = z.infer<typeof inspectionSchema>;
export interface LinkedSavesPlugin {
	inspect(input: { identity: string; saveFileId: string; baselineHash: string }): Promise<unknown>;
	accept(input: { identity: string; saveFileId: string; hash: string }): Promise<void>;
	write(input: {
		identity: string;
		saveFileId: string;
		expectedHash: string;
		base64: string;
		backupId: string;
		recover?: boolean;
		recoveryBackupId?: string;
	}): Promise<unknown>;
}
export const linkedSavesPlugin = registerPlugin<LinkedSavesPlugin>('LinkedSaves');
export type LinkedSourceStatus =
	| { kind: 'current'; file: StoredSaveFile; name: string; outcome: SourceInspection['outcome'] }
	| {
			kind: 'changed';
			file: StoredSaveFile;
			name: string;
			externalHash: string;
			localChanges: boolean;
			valid: boolean;
	  }
	| { kind: 'recovery'; file: StoredSaveFile; name: string; externalHash: string; backupId: string }
	| { kind: 'unavailable'; file: StoredSaveFile; message: string };

export async function sourceHash(bytes: Uint8Array) {
	const buffer = new Uint8Array(bytes).buffer;
	return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function encode(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

export class LinkedSaveSources {
	#tails = new Map<string, Promise<unknown>>();
	constructor(
		private readonly options: {
			storage: SavesStorage;
			engine: EngineApi;
			edits: SaveFileEditCoordinator;
			plugin: LinkedSavesPlugin;
			boxForSave?: (id: string) => number;
		}
	) {}

	#run<T>(file: StoredSaveFile, action: () => Promise<T>): Promise<T> {
		const key = file.linkedDocumentId ?? file.id;
		const result = (this.#tails.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
		this.#tails.set(key, result);
		void result
			.finally(() => {
				if (this.#tails.get(key) === result) this.#tails.delete(key);
			})
			.catch(() => undefined);
		return result;
	}

	async #inspect(file: StoredSaveFile) {
		const { storage, plugin } = this.options;
		const owner = await storage.getSave(file.id);
		if (!owner || owner.importedAt !== file.importedAt || !owner.linkedDocumentId)
			throw new Error('This Save File is no longer linked.');
		const baseline = await storage.getSaveBytes(owner.id);
		if (!baseline) throw new Error('The imported baseline is missing.');
		const inspection = inspectionSchema.parse(
			await plugin.inspect({
				identity: owner.linkedDocumentId,
				saveFileId: owner.id,
				baselineHash: await sourceHash(baseline)
			})
		);
		if (inspection.source.saveFileId !== owner.id) throw new Error('Source owner changed.');
		const external = documentBytes(inspection.base64);
		if ((await sourceHash(external)) !== inspection.hash)
			throw new Error('Source bytes do not match their recorded hash.');
		return {
			owner: { ...owner, linkedDocumentId: owner.linkedDocumentId },
			baseline,
			inspection,
			external
		};
	}

	observe(file: StoredSaveFile): Promise<LinkedSourceStatus> {
		return this.#run(file, async () => {
			try {
				const { owner, baseline, inspection, external } = await this.#inspect(file);
				const common = { file: owner, name: inspection.name };
				const pending = inspection.source.pending;
				if (pending)
					return {
						...common,
						kind: 'recovery',
						externalHash: inspection.hash,
						backupId: pending.recoveryBackupId
					};
				if (inspection.hash === inspection.source.baselineHash)
					return { ...common, kind: 'current', outcome: inspection.outcome };
				const local = (await this.options.storage.getWorkspace(owner.id))?.bytes ?? baseline;
				const localHash = await sourceHash(local);
				if (localHash === inspection.hash) {
					await this.options.plugin.accept({
						identity: owner.linkedDocumentId,
						saveFileId: owner.id,
						hash: inspection.hash
					});
					return { ...common, kind: 'current', outcome: inspection.outcome };
				}
				const validation = await this.options.engine.loadSaveWorkspace(
					external,
					inspection.name,
					0,
					{ background: true }
				);
				return {
					...common,
					kind: 'changed',
					externalHash: inspection.hash,
					localChanges: localHash !== inspection.source.baselineHash,
					valid: validation.ok
				};
			} catch (error) {
				return {
					kind: 'unavailable',
					file,
					message: error instanceof Error ? error.message : String(error)
				};
			}
		});
	}

	export(file: StoredSaveFile, serialize: () => Promise<Uint8Array>) {
		return this.#run(file, async () => {
			const bytes = await serialize();
			const { owner, inspection, external } = await this.#inspect(file);
			if (inspection.source.pending)
				throw new Error(
					'An interrupted Export needs recovery. Open Linked save folders in Settings.'
				);
			const valid = await this.options.engine.loadSaveWorkspace(bytes, inspection.name, 0, {
				background: true
			});
			if (!valid.ok) throw new Error(valid.error.message);
			if (bytesEqual(bytes, external)) {
				await this.options.plugin.accept({
					identity: owner.linkedDocumentId,
					saveFileId: owner.id,
					hash: inspection.hash
				});
				return { name: inspection.name, written: false };
			}
			if (inspection.hash !== inspection.source.baselineHash)
				throw new Error(
					'The emulator changed this save. Both versions are preserved. Review the external version in Settings, or use Export a copy.'
				);
			const sourceValid = await this.options.engine.loadSaveWorkspace(
				external,
				inspection.name,
				0,
				{ background: true }
			);
			if (!sourceValid.ok)
				throw new Error('The external save is no longer valid. Export a separate copy.');
			const backup = await this.options.storage.createBackup({
				saveFileId: owner.id,
				bytes: external,
				reason: 'linked-source-before-export'
			});
			await this.options.plugin.write({
				identity: owner.linkedDocumentId,
				saveFileId: owner.id,
				expectedHash: inspection.hash,
				base64: encode(bytes),
				backupId: backup.id
			});
			const verified = await this.#inspect(owner);
			if (!bytesEqual(verified.external, bytes) || verified.inspection.source.pending)
				throw new Error(
					'Export outcome is not verified. Its backup is retained; review recovery in Settings.'
				);
			return { name: inspection.name, written: true };
		});
	}

	loadExternal(file: StoredSaveFile, expectedHash: string, allowDirty: boolean) {
		return this.#run(file, async () => {
			const { owner, baseline, inspection, external } = await this.#inspect(file);
			if (inspection.source.pending)
				throw new Error('Resolve interrupted Export before loading external data.');
			if (inspection.hash !== expectedHash)
				throw new Error('The source changed again. Rescan before loading it.');
			const persisted = await this.options.storage.getWorkspace(owner.id);
			const local = persisted?.bytes ?? baseline;
			const box = this.options.boxForSave?.(owner.id) ?? 0;
			const parsed = await this.options.engine.loadSaveWorkspace(
				local,
				owner.originalFileName ?? undefined,
				box
			);
			if (!parsed.ok) throw new Error(parsed.error.message);
			const state = createPersistedWorkspaceState({
				file: owner,
				bytes: local,
				workspace: parsed.value,
				dirty: persisted?.dirty ?? false,
				automaticBackupCreated: persisted?.automaticBackupCreated ?? false
			});
			const origin = this.options.edits.openWorkspace(state, box);
			const replaced = await this.options.edits.replaceFromLinkedSource(
				origin,
				external,
				allowDirty
			);
			await this.options.plugin.accept({
				identity: owner.linkedDocumentId,
				saveFileId: owner.id,
				hash: inspection.hash
			});
			return replaced;
		});
	}

	recover(file: StoredSaveFile, expectedHash: string) {
		return this.#run(file, async () => {
			const { owner, inspection, external } = await this.#inspect(file);
			const pending = inspection.source.pending;
			if (!pending || inspection.hash !== expectedHash)
				throw new Error('Recovery state changed. Rescan before continuing.');
			const backups = await this.options.storage.listBackups(owner.id);
			if (
				!backups.some(
					(backup) => backup.id === pending.recoveryBackupId && backup.saveFileId === owner.id
				)
			)
				throw new Error('The source recovery Backup is missing.');
			const bytes = await this.options.storage.getBackupBytes(pending.recoveryBackupId);
			if (!bytes || (await sourceHash(bytes)) !== pending.recoveryHash)
				throw new Error('Recovery Backup does not match the original source.');
			const valid = await this.options.engine.loadSaveWorkspace(bytes, inspection.name, 0, {
				background: true
			});
			if (!valid.ok) throw new Error(valid.error.message);
			const before = await this.options.storage.createBackup({
				saveFileId: owner.id,
				bytes: external,
				reason: 'linked-source-before-recovery'
			});
			await this.options.plugin.write({
				identity: owner.linkedDocumentId,
				saveFileId: owner.id,
				expectedHash: inspection.hash,
				base64: encode(bytes),
				backupId: before.id,
				recover: true,
				recoveryBackupId: pending.recoveryBackupId
			});
			const verified = await this.#inspect(owner);
			if (!bytesEqual(verified.external, bytes) || verified.inspection.source.pending)
				throw new Error('Source recovery is not verified. Keep both Backups.');
		});
	}
}
