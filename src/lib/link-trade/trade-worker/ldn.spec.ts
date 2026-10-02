import { describe, expect, it } from 'vitest';
import { fromHex, toHex } from './bytes';
import type { LdnProtocol, SwitchKeys } from './crypto';
import {
	authenticationRequestPayload,
	decodeAdvertisement,
	decodeAuthenticationFrame,
	decodeChallengeRequest,
	encodeAdvertisement,
	encodeAuthenticationFrame,
	encodeChallengeRequest
} from './ldn';
import vectors from './test-vectors.json';

const keys = Object.fromEntries(
	Object.entries(vectors.keys).map(([name, hex]) => [name, fromHex(hex)])
) as unknown as SwitchKeys;
const networkId = {
	localCommunicationId: 0x0100abf008968000n,
	sceneId: 60001,
	ssid: fromHex(vectors.derivation.network_id).slice(16)
};
const challenge = {
	token: 0x1122334455667788n,
	nonce: 0x0102030405060708n,
	deviceId: 0x8877665544332211n
};

describe('LDN advertisements', () => {
	for (const v of vectors.advertisements) {
		const protocol = v.protocol as LdnProtocol;
		it(`decodes and re-encodes a protocol ${protocol} advertisement`, async () => {
			const network = await decodeAdvertisement(fromHex(v.action), keys, protocol);
			expect(network).toMatchObject({
				localCommunicationId: 0x0100abf008968000n,
				sceneId: 60001,
				version: 3,
				appVersion: 7,
				maxParticipants: 2,
				numParticipants: 1,
				challenge: 0x1122334455667788n
			});
			expect(network?.participants[0]).toMatchObject({
				ipAddress: '169.254.100.1',
				connected: true
			});
			expect(toHex(network!.applicationData.slice(0, 4))).toBe('0a0b0c0d');
			expect(toHex(await encodeAdvertisement({ ...network!, channel: 11 }, keys))).toBe(v.action);
		});
	}

	it('ignores an advertisement sealed under other keys', async () => {
		const other = { ...keys, master_key_12: new Uint8Array(16) };
		expect(await decodeAdvertisement(fromHex(vectors.advertisements[1].action), other, 3)).toBe(
			null
		);
	});
});

describe('LDN authentication', () => {
	it('builds the challenge byte for byte', async () => {
		const encoded = await encodeChallengeRequest(challenge);
		expect(toHex(encoded)).toBe(vectors.challenge_request);
		expect(await decodeChallengeRequest(encoded)).toEqual(challenge);
	});

	for (const v of vectors.authentication) {
		const protocol = v.protocol as LdnProtocol;
		it(`builds the protocol ${protocol} request and reads the response`, async () => {
			const request = await encodeAuthenticationFrame(
				{
					version: 3,
					statusCode: 0,
					isResponse: false,
					networkId,
					serverRandom: fromHex(vectors.derivation.server_random),
					clientRandom: fromHex(vectors.derivation.client_random),
					payload: authenticationRequestPayload(
						new TextEncoder().encode('PKSX'),
						7,
						await encodeChallengeRequest(challenge),
						3
					)
				},
				keys,
				protocol
			);
			expect(toHex(request)).toBe(v.request);
			const response = await decodeAuthenticationFrame(fromHex(v.response), keys, protocol);
			expect(response).toMatchObject({ isResponse: true, statusCode: 0, version: 3 });
			expect(response?.payload.length).toBe(0x184);
		});
	}
});
