import { describe, expect, it } from 'vitest';
import { fromHex, toHex } from './bytes';
import {
	deriveAdvertiseKey,
	deriveAuthenticationKey,
	deriveDataKey,
	type LdnProtocol,
	type SwitchKeys
} from './crypto';
import vectors from './test-vectors.json';

const keys = Object.fromEntries(
	Object.entries(vectors.keys).map(([name, hex]) => [name, fromHex(hex)])
) as unknown as SwitchKeys;
const d = vectors.derivation;

describe('LDN key derivation', () => {
	for (const protocol of [1, 3] as LdnProtocol[]) {
		it(`derives protocol ${protocol}'s keys as LDN does`, async () => {
			const want = d.keys[String(protocol) as '1' | '3'];
			expect(toHex(await deriveAdvertiseKey(keys, protocol, fromHex(d.network_id)))).toBe(
				want.advertise
			);
			expect(
				toHex(await deriveDataKey(keys, protocol, fromHex(d.server_random), fromHex(d.password)))
			).toBe(want.data);
			expect(toHex(await deriveAuthenticationKey(keys, protocol, fromHex(d.client_random)))).toBe(
				want.authentication
			);
		});
	}
});
