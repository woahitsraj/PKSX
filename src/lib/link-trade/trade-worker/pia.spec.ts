import { describe, expect, it } from 'vitest';
import { fromHex, toHex } from './bytes';
import { buildUdp } from './ip';
import {
	buildAckMessage,
	buildConnectionRequest,
	buildConnectionResponse,
	buildDataMessage,
	buildJoinRequest,
	buildLocalAck,
	buildMessage,
	buildMigrationFinish,
	buildMigrationResponse,
	buildPacket,
	buildSnapshotAck,
	buildSnapshotControl,
	buildSnapshotDone,
	buildSnapshotDoneAck,
	buildSnapshotFragment,
	buildStationAck,
	ldnConstantId,
	ldnServiceVariableId,
	LOCAL_PROTOCOL,
	openPacket,
	packetIv,
	parsePacket,
	parseUpdateSession,
	rewriteUpdateMesh,
	rttResponse,
	seadBytes,
	sessionKeys,
	stationLocation
} from './pia';
import vectors from './test-vectors.json';

const v = vectors.pia;
const p = vectors.protocols;
const ourMac = fromHex(v.our_mac);
const ourConstant = BigInt(v.our_constant);

describe('Pia version 4 session crypto', () => {
	it('derives the session key, IV and station ids as pokeldn does', async () => {
		expect(toHex(seadBytes(v.sead_seed, 16))).toBe(v.sead_bytes);
		const keys = await sessionKeys(fromHex(v.application_data));
		expect(toHex(keys.sessionKey)).toBe(v.session_key);
		expect(toHex(keys.networkIdLe)).toBe(v.network_id_le);
		expect(toHex(packetIv(keys, ourMac, fromHex(v.nonce8), 0))).toBe(v.iv);
		expect(ldnConstantId(ourMac)).toBe(ourConstant);
		expect(ldnConstantId(fromHex(v.host_mac))).toBe(BigInt(v.host_constant));
		expect(ldnServiceVariableId(ourMac)).toBe(v.service_variable_id);
	});

	it('seals a packet byte for byte and opens it again', async () => {
		const keys = await sessionKeys(fromHex(v.application_data));
		const message = buildMessage(buildLocalAck(42), LOCAL_PROTOCOL, ourConstant);
		expect(toHex(message)).toBe(v.message);
		const packet = await buildPacket(keys.sessionKey, fromHex(v.iv), message, 0, fromHex(v.nonce8));
		expect(toHex(packet)).toBe(v.packet);
		const opened = await openPacket(keys, ourMac, packet);
		const [m] = await parsePacket(opened!.plain);
		expect(m).toMatchObject({ protocol: LOCAL_PROTOCOL, port: 0, source: ourConstant });
		expect(toHex(m.payload)).toBe(toHex(buildLocalAck(42)));
	});

	it('rejects a tampered packet', async () => {
		const keys = await sessionKeys(fromHex(v.application_data));
		const packet = fromHex(v.packet);
		packet[packet.length - 1] ^= 1;
		expect(await openPacket(keys, ourMac, packet)).toBe(null);
	});

	it('splits packed messages and stops at padding', async () => {
		const messages = await parsePacket(fromHex(v.two_messages + 'ffff'));
		expect(messages.map((m) => [m.protocol, m.port, toHex(m.payload)])).toEqual([
			[0x7c, 1, '010203'],
			[0x58, 0, '0404040404']
		]);
	});
});

describe('Pia protocols', () => {
	it('builds every message pokeldn builds, byte for byte', () => {
		const location = stationLocation(
			'169.254.100.2',
			12345,
			ourConstant,
			0x01020304,
			ldnServiceVariableId(ourMac)
		);
		expect(toHex(buildLocalAck(0x01020304))).toBe(p.local_ack);
		expect(toHex(location)).toBe(p.location);
		expect(toHex(buildConnectionRequest(0x5583f53ce2980000n, 0x4cd34c2e, location))).toBe(
			p.connection_request
		);
		expect(toHex(buildConnectionResponse(0, 0x5583f53ce2980000n, 0x4cd34c2e))).toBe(
			p.connection_response
		);
		expect(toHex(buildStationAck(0x857f363a))).toBe(p.station_ack);
		expect(toHex(buildJoinRequest(0x97fe95ac))).toBe(p.join_request);
		expect(toHex(buildMigrationFinish(1))).toBe(p.migration_finish);
		expect(toHex(buildMigrationResponse(1))).toBe(p.migration_response);
		expect(toHex(buildDataMessage(fromHex('610000000a00')))).toBe(p.data_first);
		expect(toHex(buildDataMessage(fromHex('610000001200'), 7, [0x5583f53ce2980000n]))).toBe(
			p.data_later
		);
		expect(toHex(buildAckMessage(8))).toBe(p.ack_all_slots);
		expect(toHex(buildSnapshotControl(0, 3456))).toBe(p.broadcast_control);
		expect(
			toHex(
				buildSnapshotFragment(
					1,
					0,
					Uint8Array.from({ length: 40 }, (_, i) => i)
				)
			)
		).toBe(p.broadcast_fragment);
		expect(toHex(buildSnapshotAck(2, 1, 1n, 6))).toBe(p.broadcast_ack);
		expect(toHex(buildSnapshotDone(3, 2))).toBe(p.broadcast_done);
		expect(toHex(buildSnapshotDoneAck(4, 5))).toBe(p.broadcast_done_ack);
		expect(toHex(rttResponse(fromHex('00' + '00'.repeat(7) + '0000000102030405'))!)).toBe(
			p.rtt_response
		);
		const big = Uint8Array.from({ length: 2000 }, (_, i) => i % 200);
		expect(buildUdp('169.254.100.2', '169.254.100.1', 12345, 12345, big, 9).map(toHex)).toEqual(
			p.udp
		);
	});

	it('reads an update session and rewrites an update mesh', () => {
		expect(parseUpdateSession(fromHex(p.update_session))).toEqual({
			sequenceId: 7,
			hostVariableId: 0x55667788,
			hostConstantId: 0x5583f53ce2980000n,
			hostMigrationState: 1
		});
		expect(toHex(rewriteUpdateMesh(fromHex(p.update_mesh), 1, 6))).toBe(p.update_mesh_rewrite);
		expect(rttResponse(fromHex('01' + '00'.repeat(15)))).toBe(null);
	});
});
