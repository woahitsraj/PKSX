import { describe, expect, it, vi } from 'vitest';
import type { SaveSlotRef } from '$lib/engine';
import type { SlotView } from '$lib/components/pksx/types';
import {
	applyPokemonEditorEdits,
	cancelPokemonEditor,
	createPokemonEditOperation,
	createPokemonEditorState,
	isSamePokemonEditorSourceIdentity,
	markUnsupportedPokemonEditorApply,
	stageLevelExperienceEdit,
	stagePokemonEditorEdit,
	type PokemonEditorApplyServices,
	type PokemonEditorSourceInput
} from '.';

const slotRef: SaveSlotRef = { zone: 'box', box: 0, slot: 0 };

const source: PokemonEditorSourceInput = {
	owner: 'save-file',
	saveFileId: 'save-1',
	slotRef,
	location: 'Box 1, slot 1'
};

const pokemonSlot: SlotView = {
	slot: 0,
	label: 'ARON',
	detail: 'Lv. 12',
	level: 12,
	experience: 1728,
	experienceProjection: {
		minLevel: 1,
		maxLevel: 100,
		minExperience: 0,
		maxExperience: 1_000_000,
		currentLevelMinExperience: 1728,
		nextLevelMinExperience: 2197,
		currentLevelProgress: 0
	},
	speciesId: 304,
	form: 0,
	spriteIdentity: {
		speciesId: 304,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'default'
	},
	isEgg: false,
	kind: 'pokemon'
};

const updatedPokemonSlot: SlotView = {
	...pokemonSlot,
	label: 'LAIRON',
	speciesId: 305,
	spriteIdentity: {
		...pokemonSlot.spriteIdentity!,
		speciesId: 305
	}
};

const emptySlot: SlotView = {
	slot: 1,
	label: 'Empty',
	detail: '',
	level: null,
	experience: null,
	experienceProjection: null,
	speciesId: null,
	form: null,
	spriteIdentity: null,
	isEgg: false,
	kind: 'empty'
};

const stagedEdit = {
	id: 'nickname',
	capability: 'nickname-editing',
	label: 'Set nickname',
	payload: { nickname: 'RON' }
};

function openEditor(sourceOverride = source) {
	const opened = createPokemonEditorState(sourceOverride, pokemonSlot);
	if (!opened.ok) throw new Error('Expected Pokemon Editor to open.');
	return opened.state;
}

function applyServices(
	overrides: Partial<PokemonEditorApplyServices> = {}
): PokemonEditorApplyServices {
	return {
		validate: vi.fn(async () => ({ ok: true as const })),
		mutateSaveFilePokemon: vi.fn(async () => ({
			ok: true as const,
			slot: updatedPokemonSlot,
			message: 'Applied Save File Pokemon edits.'
		})),
		mutateStoragePokemon: vi.fn(async () => ({
			ok: true as const,
			slot: updatedPokemonSlot,
			message: 'Applied Pokemon Storage edits.'
		})),
		...overrides
	};
}

describe('Pokemon editor state', () => {
	it('opens for an occupied Slot with source ownership context', () => {
		const result = createPokemonEditorState(source, pokemonSlot);

		expect(result).toMatchObject({
			ok: true,
			state: {
				source: {
					owner: 'save-file',
					saveFileId: 'save-1',
					slotRef,
					location: 'Box 1, slot 1'
				},
				slot: pokemonSlot,
				stagedEdits: [],
				staged: false,
				applyOutcome: { status: 'idle', message: null },
				unsupportedReason: null
			}
		});
	});

	it('rejects empty Slots', () => {
		expect(createPokemonEditorState(source, emptySlot)).toEqual({
			ok: false,
			reason: 'Pokemon Editor requires an occupied Slot.'
		});
	});

	it('stages engine mutation commands without mutating the source Slot projection', () => {
		const opened = openEditor();

		const staged = stagePokemonEditorEdit(opened, stagedEdit);

		expect(staged.staged).toBe(true);
		expect(staged.stagedEdits).toEqual([stagedEdit]);
		expect(staged.slot).toBe(pokemonSlot);
		expect(opened.staged).toBe(false);
	});

	it('replaces staged commands from the same capability instance', () => {
		const opened = openEditor();

		const staged = stagePokemonEditorEdit(stagePokemonEditorEdit(opened, stagedEdit), {
			...stagedEdit,
			payload: { nickname: 'IRON' }
		});

		expect(staged.stagedEdits).toHaveLength(1);
		expect(staged.stagedEdits[0]?.payload).toEqual({ nickname: 'IRON' });
	});

	it('stages valid level edits with engine-backed range metadata', () => {
		const staged = stageLevelExperienceEdit(openEditor(), { mode: 'level', level: 20 });

		expect(staged.stagedEdits).toEqual([
			{
				id: 'level-experience',
				capability: 'level-experience-editing',
				label: 'Set level to 20',
				payload: { mode: 'level', level: 20 }
			}
		]);
		expect(createPokemonEditOperation(staged)).toEqual({
			ok: true,
			operation: { source: slotRef, level: 20 }
		});
	});

	it('rejects invalid level and experience ranges without staging mutation', () => {
		const invalidLevel = stageLevelExperienceEdit(openEditor(), { mode: 'level', level: 101 });
		const invalidExperience = stageLevelExperienceEdit(openEditor(), {
			mode: 'experience',
			experience: -1
		});

		expect(invalidLevel).toMatchObject({
			stagedEdits: [],
			staged: false,
			applyOutcome: {
				status: 'rejected',
				message: 'Level must be between 1 and 100.',
				reason: 'invalid-pokemon-edit'
			}
		});
		expect(invalidExperience).toMatchObject({
			stagedEdits: [],
			staged: false,
			applyOutcome: {
				status: 'rejected',
				message: 'Experience must be between 0 and 1000000.',
				reason: 'invalid-pokemon-edit'
			}
		});
	});

	it('clears a pending level edit when a later level value is invalid', () => {
		const staged = stageLevelExperienceEdit(openEditor(), { mode: 'level', level: 20 });
		const invalid = stageLevelExperienceEdit(staged, { mode: 'level', level: 101 });

		expect(invalid).toMatchObject({
			stagedEdits: [],
			staged: false,
			applyOutcome: {
				status: 'rejected',
				message: 'Level must be between 1 and 100.',
				reason: 'invalid-pokemon-edit'
			}
		});
	});

	it('keeps cancel non-mutating and clears staged feedback', () => {
		const staged = markUnsupportedPokemonEditorApply(
			stagePokemonEditorEdit(openEditor(), stagedEdit)
		);

		expect(cancelPokemonEditor(staged)).toMatchObject({
			slot: pokemonSlot,
			stagedEdits: [],
			staged: false,
			applyOutcome: { status: 'idle', message: null },
			unsupportedReason: null
		});
	});

	it('treats no staged edits as a no-op without validation or mutation', async () => {
		const services = applyServices();

		const result = await applyPokemonEditorEdits(openEditor(), services);

		expect(result.outcome).toEqual({
			status: 'noop',
			message: 'No Pokemon edits are staged.'
		});
		expect(services.validate).not.toHaveBeenCalled();
		expect(services.mutateSaveFilePokemon).not.toHaveBeenCalled();
	});

	it('applies Save File-owned staged edits after validation and backup checks', async () => {
		const calls: string[] = [];
		const state = stagePokemonEditorEdit(openEditor(), stagedEdit);
		const services = applyServices({
			validate: vi.fn(async () => {
				calls.push('validate');
				return { ok: true as const };
			}),
			ensureSaveFileBackup: vi.fn(async () => {
				calls.push('backup');
				return { ok: true as const };
			}),
			mutateSaveFilePokemon: vi.fn(async () => {
				calls.push('mutate');
				return { ok: true as const, slot: updatedPokemonSlot, message: 'Saved.' };
			})
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(calls).toEqual(['validate', 'backup', 'mutate']);
		expect(result.outcome).toEqual({ status: 'success', message: 'Saved.' });
		expect(result.state.slot).toEqual(updatedPokemonSlot);
		expect(result.state.stagedEdits).toEqual([]);
		expect(result.state.staged).toBe(false);
	});

	it('does not create a Backup when engine validation rejects staged edits', async () => {
		const state = stagePokemonEditorEdit(openEditor(), stagedEdit);
		const services = applyServices({
			validate: vi.fn(async () => ({
				ok: false as const,
				status: 'rejected' as const,
				message: 'Nickname is not valid for this format.'
			})),
			ensureSaveFileBackup: vi.fn(async () => ({ ok: true as const }))
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'rejected',
			message: 'Nickname is not valid for this format.'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
		expect(services.ensureSaveFileBackup).not.toHaveBeenCalled();
		expect(services.mutateSaveFilePokemon).not.toHaveBeenCalled();
	});

	it('keeps staged edits when backup creation fails before mutation', async () => {
		const state = stagePokemonEditorEdit(openEditor(), stagedEdit);
		const services = applyServices({
			ensureSaveFileBackup: vi.fn(async () => ({
				ok: false as const,
				status: 'failed' as const,
				message: 'Backup could not be created.',
				reason: 'backup-write-failed'
			}))
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'failed',
			message: 'Backup could not be created.',
			reason: 'backup-write-failed'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
		expect(services.mutateSaveFilePokemon).not.toHaveBeenCalled();
	});

	it('records unsupported apply feedback without staging a mutation', async () => {
		const state = stagePokemonEditorEdit(openEditor(), stagedEdit);
		const services = applyServices({
			validate: vi.fn(async () => ({
				ok: false as const,
				status: 'unsupported' as const,
				message: 'Engine-backed Pokemon editing is not available yet.',
				reason: 'engine-unavailable'
			}))
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'unsupported',
			message: 'Engine-backed Pokemon editing is not available yet.',
			reason: 'engine-unavailable'
		});
		expect(result.state.unsupportedReason).toBe(
			'Engine-backed Pokemon editing is not available yet.'
		);
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
	});

	it('routes Pokemon Storage-owned apply through the storage mutation boundary', async () => {
		const storageSource: PokemonEditorSourceInput = {
			owner: 'pokemon-storage',
			storagePokemonId: 'stored-pokemon-1',
			location: 'Storage Box 1, slot 1'
		};
		const state = stagePokemonEditorEdit(openEditor(storageSource), stagedEdit);
		const services = applyServices({
			ensureSaveFileBackup: vi.fn(async () => ({ ok: true as const }))
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(result.outcome.status).toBe('success');
		expect(services.mutateStoragePokemon).toHaveBeenCalledWith(state);
		expect(services.ensureSaveFileBackup).not.toHaveBeenCalled();
		expect(services.mutateSaveFilePokemon).not.toHaveBeenCalled();
	});

	it('keeps level edits staged when Save File mutation fails', async () => {
		const state = stageLevelExperienceEdit(openEditor(), { mode: 'level', level: 18 });
		const services = applyServices({
			mutateSaveFilePokemon: vi.fn(async () => ({
				ok: false as const,
				status: 'failed' as const,
				message: 'Engine mutation failed.',
				reason: 'engine-unavailable'
			}))
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'failed',
			message: 'Engine mutation failed.',
			reason: 'engine-unavailable'
		});
		expect(result.state.stagedEdits).toEqual(state.stagedEdits);
	});

	it('refuses apply when the source no longer identifies the same Pokemon Entity', async () => {
		const state = stagePokemonEditorEdit(openEditor(), stagedEdit);
		const services = applyServices({
			verifySource: vi.fn(async () => ({
				ok: false,
				message: 'Pokemon Editor source changed before Apply.'
			}))
		});

		const result = await applyPokemonEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'failed',
			message: 'Pokemon Editor source changed before Apply.',
			reason: 'stale-source'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
		expect(services.validate).not.toHaveBeenCalled();
		expect(services.mutateSaveFilePokemon).not.toHaveBeenCalled();
	});

	it('compares editor source identity against current Slot projections', () => {
		const state = openEditor();

		expect(isSamePokemonEditorSourceIdentity(state, pokemonSlot)).toBe(true);
		expect(isSamePokemonEditorSourceIdentity(state, updatedPokemonSlot)).toBe(false);
		expect(isSamePokemonEditorSourceIdentity(state, emptySlot)).toBe(false);
		expect(isSamePokemonEditorSourceIdentity(state, null)).toBe(false);
	});
});
