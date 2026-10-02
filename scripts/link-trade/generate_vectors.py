"""Write the trade worker's test vectors from the pinned pokeldn Python source.

Usage: python generate_vectors.py POKELDN_CHECKOUT > src/lib/link-trade/trade-worker/test-vectors.json
then format the file with prettier.

POKELDN_CHECKOUT is https://github.com/Decryptu/pokeldn at f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691.
Needs pycryptodome. Every key below is a synthetic pattern, not a console key.
"""
import hashlib
import json
import os
import sys

ROOT = os.path.abspath(sys.argv[1])
sys.path[:0] = [ROOT, os.path.join(ROOT, "vendor", "LDN")]

from ldn import (AdvertisementFrame, AdvertisementInfo, AuthenticationFrame,  # noqa: E402
                 AuthenticationRequest, AuthenticationResponse, ChallengeRequest,
                 ChallengeResponse, KeyDerivation, NetworkId, ParticipantInfo, MACAddress,
                 ADVERTISE_FORMAT_AES_CTR, ADVERTISE_FORMAT_AES_GCM, CHALLENGE_KEY)
from pokeldn.ldn import (broadcast4, esp32, local_protocol as lp, mesh_protocol as mesh,  # noqa: E402
                         pia4, reliable4, reliable5, rtt_protocol as rtt, station4,
                         station_protocol as stp, userspace_ip)
from pokeldn.ldn.sead import Sead  # noqa: E402
from pokeldn.swsh import PASSPHRASE, GAME_KEY, packet_iv, session_keys  # noqa: E402
from pokeldn.swsh import trade, trade_payload  # noqa: E402


def h(b):
    return bytes(b).hex()


def pattern(seed, size=16):
    return hashlib.sha256(seed.encode()).digest()[:size]


KEYS = {name: pattern(name) for name in ("aes_kek_generation_source", "aes_key_generation_source",
                                         "master_key_00", "master_key_12")}

out = {"source": "pokeldn f52f3db6211bf81aa2bcea5f4f38d4ecff9a8691",
       "keys": {k: h(v) for k, v in KEYS.items()}}

# Serial framing.
frames = []
for msg_type, payload in ((0x01, b""), (0x81, bytes([1]) + bytes(range(13)) + b"pokeldn-radio esp32 version=1.0.0 idf=v6.1"),
                          (0x08, bytes(300)), (0x85, bytes(range(256)) * 2), (0x82, bytes([0x04, 0, 0, 0, 0]))):
    frames.append({"type": msg_type, "payload": h(payload), "frame": h(esp32.encode_frame(msg_type, payload))})
out["frames"] = frames
out["sta_join"] = h(esp32.sta_join_payload(11, bytes.fromhex("02a1b2c3d4e5"), "00112233445566778899aabbccddeeff",
                                           pattern("data key"), bytes.fromhex("02f1e2d3c4b5")))

# Key derivation and the LDN frames.
network_id = NetworkId(0x0100ABF008968000, 60001, pattern("ssid"))
derivation = {}
for protocol in (1, 3):
    kd = KeyDerivation(KEYS, protocol)
    derivation[str(protocol)] = {
        "advertise": h(kd.derive_advertise_key(network_id.encode(">"))),
        "data": h(kd.derive_data_key(pattern("server random"), PASSPHRASE)),
        "authentication": h(kd.derive_authentication_key(pattern("client random"))),
    }
out["derivation"] = {"network_id": h(network_id.encode(">")), "network_id_le": h(network_id.encode("<")),
                     "server_random": h(pattern("server random")), "client_random": h(pattern("client random")),
                     "password": h(PASSPHRASE), "keys": derivation}

host = ParticipantInfo("169.254.100.1", MACAddress("02:a1:b2:c3:d4:e5"), True, b"Host", 7, 0)
adverts = []
for protocol, fmt in ((1, ADVERTISE_FORMAT_AES_CTR), (3, ADVERTISE_FORMAT_AES_GCM)):
    frame = AdvertisementFrame(KeyDerivation(KEYS, protocol), protocol)
    frame.network_id = network_id
    frame.version = 3
    frame.format = fmt
    frame.nonce = bytes.fromhex("01020304")
    info = AdvertisementInfo()
    info.server_random = pattern("server random")
    info.app_version = 7
    info.channel = 11
    info.band = 2
    info.max_participants = 2
    info.num_participants = 1
    info.participants = [host] + [ParticipantInfo() for _ in range(7)]
    info.application_data = bytes.fromhex("0a0b0c0d00000000000000000403 0201".replace(" ", "")) + bytes(8)
    info.challenge = 0x1122334455667788
    frame.payload = info
    adverts.append({"protocol": protocol, "action": h(frame.encode())})
out["advertisements"] = adverts

auths = []
for protocol in (1, 3):
    kd = KeyDerivation(KEYS, protocol)
    challenge = ChallengeRequest(flags=0, token=0x1122334455667788, nonce=0x0102030405060708,
                                 device_id=0x8877665544332211)
    request = AuthenticationRequest(b"PKSX", 7, 0, challenge.encode(CHALLENGE_KEY))
    frame = AuthenticationFrame(kd, protocol)
    frame.version = 3
    frame.network_id = network_id
    frame.server_random = pattern("server random")
    frame.client_random = pattern("client random")
    frame.payload = request
    response = AuthenticationFrame(kd, protocol)
    response.version = 3
    response.status_code = 0
    response.network_id = network_id
    response.server_random = pattern("server random")
    response.client_random = pattern("client random")
    reply = ChallengeResponse(flags=2, nonce=challenge.nonce, device_id=challenge.device_id,
                              device_id_host=0x0A0B0C0D0E0F1011)
    response.payload = AuthenticationResponse(0, reply.encode(CHALLENGE_KEY))
    auths.append({"protocol": protocol, "request": h(frame.encode()), "response": h(response.encode())})
out["authentication"] = auths
out["challenge_request"] = h(ChallengeRequest(0, 0x1122334455667788, 0x0102030405060708,
                                              0x8877665544332211).encode(CHALLENGE_KEY))

# Pia version 4 session crypto and messages.
app = bytes.fromhex("0a0b0c0d") + bytes(8) + bytes.fromhex("04030201") + bytes(8)


class Net:
    application_data = app


keys = session_keys(Net())
our_mac, host_mac = bytes.fromhex("02f1e2d3c4b5"), bytes.fromhex("02a1b2c3d4e5")
our_constant = stp.ldn_constant_id(our_mac)
nonce8 = bytes.fromhex("0011223344556677")
message = pia4.build_message(lp.build_ack(42), lp.PROTOCOL, our_constant)
iv = packet_iv(keys, our_mac, nonce8, source_id=0)
out["pia"] = {
    "application_data": h(app), "game_key": h(GAME_KEY),
    "sead_seed": 0x01020304, "sead_bytes": h(Sead(seed=0x01020304).bytes(16)),
    "session_key": h(keys.session_key), "network_id_le": h(keys.network_id_le),
    "our_mac": h(our_mac), "host_mac": h(host_mac),
    "our_constant": str(our_constant), "host_constant": str(stp.ldn_constant_id(host_mac)),
    "service_variable_id": stp.ldn_service_variable_id(our_mac),
    "nonce8": h(nonce8), "iv": h(iv), "message": h(message),
    "packet": h(pia4.build_packet(keys.session_key, iv, message, station=0, nonce8=nonce8)),
    "two_messages": h(pia4.build_message(b"\x01\x02\x03", 0x7C, our_constant, port=1, destination=1)
                      + pia4.build_message(b"\x04" * 5, 0x58, our_constant, message_flags=0x01)),
}

location = stp.station_location("169.254.100.2", 12345, our_constant, 0x01020304,
                                stp.ldn_service_variable_id(our_mac))
out["protocols"] = {
    "local_ack": h(lp.build_ack(0x01020304)),
    "update_session": h(lp.build_update_session(7, 0x11223344, 0x55667788, 0x99AABBCC, 0xB2D4E5C3A1020000,
                                                [("169.254.100.1", 12345, 0)], host_migration_state=1)),
    "location": h(location),
    "connection_request": h(station4.build_connection_request(0xB2D4E5C3A1020000, 0x0A0B0C0D, location,
                                                              nat_flags=0, nat_location=0, platform=9,
                                                              with_variable_id=False)),
    "connection_response": h(station4.build_connection_response(0, 0xB2D4E5C3A1020000, 0x0A0B0C0D)),
    "station_ack": h(station4.build_ack(0x11112222)),
    "join_request": h(mesh.build_join_request(0x33334444)),
    "migration_finish": h(mesh.build_migration_finish(1)),
    "migration_response": h(mesh.build_migration_response(1)),
    "update_mesh": h(mesh.build_update_mesh_v4(0, [(location, 0)], 5)),
    "update_mesh_rewrite": h(mesh.rewrite_update_mesh(mesh.build_update_mesh_v4(0, [(location, 0)], 5), 1, 6)),
    "rtt_response": h(rtt.response_for_v4(bytes([0]) + bytes(7) + bytes.fromhex("0000000102030405"))),
    "data_first": h(reliable4.build_data_message(bytes.fromhex("610000000a00"))),
    "data_later": h(reliable4.build_data_message(bytes.fromhex("610000001200"), sequence_id=7,
                                                 destinations=[0xB2D4E5C3A1020000])),
    "ack_all_slots": h(reliable4.build_ack_message(8)),
    "broadcast_control": h(broadcast4.build_control(0, 3456)),
    "broadcast_fragment": h(broadcast4.build_fragment(1, 0, bytes(range(40)), compress=False)[0]),
    "broadcast_ack": h(broadcast4.build_ack(2, 1, 1, 6)),
    "broadcast_done": h(broadcast4.build_done(3, 2)),
    "broadcast_done_ack": h(broadcast4.build_done_ack(4, 5)),
    "udp": [h(p) for p in userspace_ip.build_udp("169.254.100.2", "169.254.100.1", 12345, 12345,
                                                  bytes(range(200)) * 10, ident=9)],
}

pk8 = pattern("pk8", 32) * 10 + bytes(24)
assert len(pk8) == 0x158
pair = trade.build_rpc_pair(trade.OFFER_OFFSET, our_constant, 2348)
console_status = trade.build_rpc(50, 20000, 0x0102030405060708, 4256, bytes.fromhex("00000100"))
out["swsh"] = {
    "pk8": h(pk8),
    "sync_ping": h(trade.sync(97, trade.PING)),
    "result": h(trade.result()),
    "im_ready": h(trade.im_ready()),
    "pokemon_trade": h(trade.pokemon_trade(pk8)),
    "pokemon_offer": h(trade.pokemon_offer(50, pk8)),
    "open_content_offer": h(trade.pokemon_offer(30, pk8)),
    "box_sync_state": h(trade.box_sync_state(4)),
    "sync_command": h(trade.sync_command(40, 3)),
    "rpc_pair": [h(p) for p in pair],
    "console_status": h(console_status),
    "answer": h(trade.answer_rpc(console_status, our_constant, 9)),
    "parsed_status": {k: (h(v) if isinstance(v, bytes) else v) for k, v in trade.parse_rpc(console_status).items()},
    "answers": {h(k): [h(v) for v in vs] for k, vs in trade.SYNC_ANSWERS.items()},
}
payload = bytes(pattern(f"snapshot {i}", 32)[j % 32] for i in range(108) for j in range(32))
assert len(payload) == trade_payload.PAYLOAD_LENGTH
out["snapshot"] = {"payload": h(payload),
                   "rewritten": h(payload[:trade_payload.PARTY_COUNT_OFFSET]
                                  + trade_payload.rewrite(payload[:0] + bytes(0x810) + payload[0x810:],
                                                          trainer_name="PKSX", trainer_id=12345,
                                                          secret_id=54321)[0x810:])}
json.dump(out, sys.stdout, indent=1)
print()
