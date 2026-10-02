import { describe, expect, test } from 'vitest';
import letsGoEeveeFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin?url';
import legendsArceusFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-legends-arceus-2025-03-24-main.sav?url';
import scarletFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav?url';
import swordFixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-sword-2025-03-24-main.sav?url';
import { createPkhexEngine } from './pkhex-engine';
import type { EngineApi, LinkTradeDestinationGame, OutgoingLinkTrade } from './types';

type Slot = { speciesId: number; form: number; entityBytesBase64?: string | null };

const partySize = 0x158;
const storedSize = 0x148;

describe('Outgoing Link Trades through the browser-wasm bundle', () => {
	test('offers a native Sword/Shield Pokemon as its exact encrypted party bytes', async () => {
		const engine = await createPkhexEngine('/pkhex-engine');
		const slots = await loadSlots(engine, swordFixtureUrl, 'pokemon-sword-2025-03-24-main.sav');
		const { source, offer } = await findOffer(
			engine,
			slots,
			(offer) => offer.ready && offer.legality?.legal === true
		);
		const sourceCopy = source.slice();

		expect(offer).toMatchObject({
			destinationGame: 'sword',
			entityFormat: 'PK8',
			converted: false,
			changes: [],
			blockingReasons: [],
			sourceSha256: await sha256(source)
		});
		expect(source).toEqual(sourceCopy);
		const outgoingBytes = offer.outgoingBytes!;
		expect(outgoingBytes.byteLength).toBe(partySize);
		expect(offer.outgoingSha256).toBe(await sha256(outgoingBytes));

		const again = await engine.prepareOutgoingLinkTrade(source, {
			destinationGame: 'shield',
			sourceKind: 'entity'
		});
		expect(again.ok && again.value.outgoingSha256).toBe(offer.outgoingSha256);

		const sourceParty = new Uint8Array(partySize);
		sourceParty.set(source);
		for (const received of [outgoingBytes, outgoingBytes.slice(0, storedSize)]) {
			const parsed = await engine.readLinkTradePartnerPokemon(received, 'sword');
			if (!parsed.ok || !parsed.value.parsed) throw new Error('Expected the offer to parse.');
			expect(parsed.value.entityFormat).toBe('PK8');
			expect(parsed.value.receivedSha256).toBe(await sha256(received));
			expect(parsed.value.entityBytes!.slice(0, received.byteLength)).toEqual(
				sourceParty.slice(0, received.byteLength)
			);
			expect(parsed.value.legality?.legal).toBe(true);
			const payload = await engine.createPreservationPayload(parsed.value.entityBytes!);
			expect(payload.ok && payload.value.summary.currentEntityFormat).toBe('PK8');
		}

		const stored = await engine.createPreservationPayload(source);
		if (!stored.ok) throw new Error('Expected the Sword Pokemon preservation payload.');
		const newer = await engine.projectPreservationPayload(stored.value.bytes, 9);
		if (!newer.ok) throw new Error('Expected the PK9 projection.');
		const restored = await engine.prepareOutgoingLinkTrade(newer.value.bytes, {
			destinationGame: 'sword',
			sourceKind: 'preservation-payload'
		});
		expect(restored.ok && restored.value).toMatchObject({
			converted: false,
			outgoingSha256: offer.outgoingSha256,
			sourceSha256: await sha256(newer.value.bytes)
		});
	});

	test('converts a Scarlet Pokemon to a sendable PK8 without fixing legality', async () => {
		const engine = await createPkhexEngine('/pkhex-engine');
		const slots = await loadSlots(engine, scarletFixtureUrl, 'pokemon-scarlet-2025-03-24-main.sav');

		const { offer } = await findOffer(engine, slots, (offer) => offer.ready);
		expect(offer).toMatchObject({ entityFormat: 'PK8', converted: true, blockingReasons: [] });
		expect(offer.changes).toContainEqual({ field: 'Format', before: 'PK9', after: 'PK8' });
		expect(offer.legality?.warnings.map((line) => line.message)).toContain(
			'Invalid: Pokémon HOME Transfer Tracker is missing.'
		);
		expect(offer.outgoingSha256).toBe(await sha256(offer.outgoingBytes!));
		const sent = await engine.readLinkTradePartnerPokemon(offer.outgoingBytes!, 'sword');
		expect(sent.ok && sent.value).toMatchObject({
			parsed: true,
			entityFormat: 'PK8',
			projection: { speciesId: offer.projection!.speciesId }
		});

		const scarletOnly = slots.find((slot) => slot.speciesId > 898)!;
		const rejected = await engine.prepareOutgoingLinkTrade(entityBytes(scarletOnly), {
			destinationGame: 'sword',
			sourceKind: 'entity'
		});
		expect(rejected.ok && rejected.value.blockingReasons).toContainEqual(
			expect.objectContaining({ kind: 'unavailable-in-game' })
		);
	});

	test('rejects a Pokemon that PKHeX cannot convert to PK8', async () => {
		const engine = await createPkhexEngine('/pkhex-engine');
		const slots = await loadSlots(
			engine,
			letsGoEeveeFixtureUrl,
			'pokemon-lets-go-eevee-2025-03-24-savedata.bin'
		);
		const starter = slots.find((slot) => slot.speciesId === 133 && slot.form === 1)!;
		const rejected = await engine.prepareOutgoingLinkTrade(entityBytes(starter), {
			destinationGame: 'sword',
			sourceKind: 'entity'
		});
		expect(rejected.ok && rejected.value).toMatchObject({
			ready: false,
			outgoingBytes: null,
			outgoingSha256: null,
			legality: null,
			blockingReasons: [{ kind: 'unsupported-conversion' }]
		});
	});

	test('treats a same-generation Legends: Arceus Pokemon as a conversion, not a native offer', async () => {
		const engine = await createPkhexEngine('/pkhex-engine');
		const slots = await loadSlots(
			engine,
			legendsArceusFixtureUrl,
			'pokemon-legends-arceus-2025-03-24-main.sav'
		);
		const source = entityBytes(slots.find((slot) => slot.speciesId === 155)!);

		for (const destinationGame of ['legends-arceus', 'brilliant-diamond', 'scarlet']) {
			expect(
				await engine.prepareOutgoingLinkTrade(source, {
					destinationGame: destinationGame as LinkTradeDestinationGame,
					sourceKind: 'entity'
				})
			).toMatchObject({ ok: false, error: { code: 'unsupported-link-trade-destination' } });
		}

		const offer = await engine.prepareOutgoingLinkTrade(source, {
			destinationGame: 'sword',
			sourceKind: 'entity'
		});
		if (!offer.ok) throw new Error(`Expected a Link Trade offer: ${offer.error.message}`);
		expect(offer.value).toMatchObject({ converted: true, ready: false, outgoingBytes: null });
		expect(offer.value.changes).toContainEqual({ field: 'Format', before: 'PA8', after: 'PK8' });
		expect(offer.value.blockingReasons).toContainEqual(
			expect.objectContaining({ kind: 'unavailable-in-game' })
		);
	});

	test('keeps malformed received bytes as an unparseable result', async () => {
		const engine = await createPkhexEngine('/pkhex-engine');
		for (const received of [new Uint8Array(partySize).fill(0x5a), new Uint8Array(12)]) {
			const parsed = await engine.readLinkTradePartnerPokemon(received, 'sword');
			expect(parsed.ok && parsed.value).toMatchObject({
				parsed: false,
				entityBytes: null,
				receivedSha256: await sha256(received),
				unparseableReason: expect.any(String)
			});
		}
	});
});

async function loadSlots(engine: EngineApi, url: string, fileName: string) {
	const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
	const workspace = await engine.loadSaveWorkspace(bytes, fileName, 0);
	if (!workspace.ok) throw new Error(`Expected ${fileName} to load.`);
	return [...workspace.value.partySlots, ...workspace.value.boxSlots].filter(
		(slot) => slot.entityBytesBase64 && !slot.isEgg
	);
}

async function findOffer(
	engine: EngineApi,
	slots: Slot[],
	matches: (offer: OutgoingLinkTrade) => boolean
) {
	for (const slot of slots) {
		const source = entityBytes(slot);
		const result = await engine.prepareOutgoingLinkTrade(source, {
			destinationGame: 'sword',
			sourceKind: 'entity'
		});
		if (result.ok && matches(result.value)) return { source, offer: result.value };
	}
	throw new Error('Expected a matching Link Trade offer.');
}

function entityBytes(slot: Slot) {
	return Uint8Array.from(atob(slot.entityBytesBase64!), (character) => character.charCodeAt(0));
}

async function sha256(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
