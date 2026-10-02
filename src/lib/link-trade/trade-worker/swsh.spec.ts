import { describe, expect, it } from 'vitest';
import { fromHex, toHex } from './bytes';
import {
	answerRpc,
	boxSyncState,
	buildOurSnapshot,
	buildRpcPair,
	imReady,
	nextAnswer,
	offeredPokemon,
	parseBoxCommand,
	parseRpc,
	parseSyncStep,
	pokemonOffer,
	pokemonTrade,
	sync,
	syncCommand
} from './swsh';
import vectors from './test-vectors.json';

const s = vectors.swsh;
const pk8 = fromHex(s.pk8);
const station = BigInt(vectors.pia.our_constant);

describe('Sword/Shield trade messages', () => {
	it('builds every message pokeldn builds, byte for byte', () => {
		expect(toHex(sync(97, 1))).toBe(s.sync_ping);
		expect(toHex(imReady())).toBe(s.im_ready);
		expect(toHex(pokemonTrade(pk8))).toBe(s.pokemon_trade);
		expect(toHex(pokemonOffer(50, pk8))).toBe(s.pokemon_offer);
		expect(toHex(pokemonOffer(30, pk8))).toBe(s.open_content_offer);
		expect(toHex(boxSyncState(4))).toBe(s.box_sync_state);
		expect(toHex(syncCommand(40, 3))).toBe(s.sync_command);
		expect(buildRpcPair(30, station, 2348n).map(toHex)).toEqual(s.rpc_pair);
		expect(toHex(answerRpc(fromHex(s.console_status), station, 9)!)).toBe(s.answer);
	});

	it('reads the console status, box commands and offers', () => {
		const rpc = parseRpc(fromHex(s.console_status))!;
		expect(rpc).toMatchObject({
			envelope: s.parsed_status.envelope,
			offset: BigInt(s.parsed_status.offset),
			base: BigInt(s.parsed_status.base),
			clock: BigInt(s.parsed_status.clock)
		});
		expect(parseSyncStep(rpc.body)).toEqual([0, 1]);
		expect(parseBoxCommand(boxSyncState(4))).toBe(4);
		expect(parseBoxCommand(pokemonTrade(pk8))).toBe(null);
		expect(toHex(offeredPokemon(pokemonTrade(pk8))!)).toBe(s.pk8);
		expect(offeredPokemon(fromHex('3e4e00'))).toBe(null);
		expect(parseRpc(fromHex('5e9c00000a'))).toBe(null);
	});

	it("answers the sync pings with pokeldn's table and offers ours for the console's", () => {
		for (const [said, answers] of Object.entries(s.answers)) {
			let [first, queue] = nextAnswer(fromHex(said), [], station, 5, null);
			const sent = [toHex(first)];
			while (queue.length) {
				[first, queue] = nextAnswer(fromHex(said), queue, station, 5, null);
				sent.push(toHex(first));
			}
			expect(sent).toEqual(answers);
		}
		const theirs = pokemonTrade(pk8.map((b) => b ^ 1));
		expect(toHex(nextAnswer(theirs, [], station, 5, pk8)[0])).toBe(s.pokemon_trade);
	});
});

describe('the trade snapshot', () => {
	it('carries our trainer identity and our offer in slot 1, unchanged', () => {
		const theirs = fromHex(vectors.snapshot.payload);
		const ours = buildOurSnapshot(theirs, pk8, {
			trainerName: 'PKSX',
			trainerId: 12345,
			secretId: 54321
		});
		const want = fromHex(vectors.snapshot.rewritten);
		want.set(pk8, 0);
		expect(toHex(ours)).toBe(toHex(want));
	});
});
