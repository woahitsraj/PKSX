import type { EngineApi } from '$lib/engine';
import type { StoredPokemonStorage, StoredPokemonStoragePokemon } from '$lib/pksx/saves';
import type { PokemonStorageService } from './service';

export async function catalogLegacyView(
	service: PokemonStorageService,
	engine: Pick<EngineApi, 'readPreservationPayload'>
): Promise<StoredPokemonStorage> {
	const manifest = service.current;
	if (!manifest) throw new Error('Pokemon Storage catalog is not initialized.');
	const boxes = service.listBoxes();
	const view: StoredPokemonStorage = {
		id: 'pokemon-storage',
		schemaVersion: 1,
		boxCount: boxes.length,
		boxSlotCount: 30,
		updatedAt: new Date().toISOString(),
		boxes: boxes.map((box, index) => ({
			index,
			name: box.name ?? `Box ${String(index + 1).padStart(2, '0')}`,
			slots: Array.from({ length: 30 }, (_, slot) => ({ box: index, slot, pokemon: null }))
		}))
	};
	const visible = new Map(service.listResolvedPlacements().map((item) => [item.recordId, item]));
	for (const record of manifest.records) {
		const placement = visible.get(record.recordId)?.placement;
		if (!placement) continue;
		const box = boxes.findIndex((item) => item.id === placement.storageBoxId);
		if (box < 0) throw new Error('Pokemon Storage placement is unavailable.');
		const payload = await service.readPayload(record.recordId);
		const parsed = await engine.readPreservationPayload(payload);
		if (!parsed.ok) throw parsed.error;
		const projection = parsed.value.projection;
		const pokemon: StoredPokemonStoragePokemon = {
			label: projection.nickname || `Species ${projection.speciesId}`,
			speciesName: projection.speciesName,
			detail: `Lv. ${projection.level}`,
			level: projection.level,
			experience: projection.experience,
			speciesId: projection.speciesId,
			form: projection.form,
			isEgg: projection.isEgg,
			spriteIdentity: projection.spriteIdentity,
			gender: projection.gender ?? undefined,
			nature: projection.nature ?? undefined,
			ability: projection.ability ?? undefined,
			heldItem: projection.heldItem ?? undefined,
			heldItemSpriteIdentity: projection.heldItemSpriteIdentity,
			originalTrainer: projection.originalTrainer ?? undefined,
			metLabel: projection.metLabel ?? undefined,
			entityBytesBase64: btoa(String.fromCharCode(...parsed.value.entityBytes)),
			origin: record.origin
		};
		view.boxes[box].slots[placement.slot].pokemon = pokemon;
	}
	return view;
}
