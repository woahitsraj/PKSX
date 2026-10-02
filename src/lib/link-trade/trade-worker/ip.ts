// SPDX-License-Identifier: AGPL-3.0-only
// Ported from pokeldn v0.4.0 `pokeldn/ldn/userspace_ip.py`: IPv4, UDP and ARP for a radio with no
// kernel interface. See ./NOTICE.md.

import { concat, equal, readU16be, u16be, view, type Bytes } from './bytes';

const ETHERTYPE_IP = 0x0800;
const ETHERTYPE_ARP = 0x0806;
const PROTO_UDP = 17;
const MTU = 1500;
const BROADCAST_MAC = new Uint8Array(6).fill(0xff);
const REASSEMBLY_TIMEOUT_MS = 5000;

const ipBytes = (address: string) => Uint8Array.from(address.split('.').map(Number));
const ipText = (data: Uint8Array) => Array.from(data).join('.');

function checksum(data: Uint8Array): number {
	let total = 0;
	for (let i = 0; i < data.length; i += 2) total += (data[i] << 8) | (data[i + 1] ?? 0);
	while (total >> 16) total = (total & 0xffff) + (total >> 16);
	return ~total & 0xffff;
}

/** -> the IPv4 packets carrying one datagram, fragmented at the MTU. */
export function buildUdp(
	srcIp: string,
	dstIp: string,
	srcPort: number,
	dstPort: number,
	payload: Uint8Array,
	ident: number
): Bytes[] {
	const src = ipBytes(srcIp);
	const dst = ipBytes(dstIp);
	const udpLength = 8 + payload.length;
	const udp = concat(u16be(srcPort), u16be(dstPort), u16be(udpLength), u16be(0), payload);
	const pseudo = concat(src, dst, Uint8Array.of(0, PROTO_UDP), u16be(udpLength));
	view(udp).setUint16(6, checksum(concat(pseudo, udp)) || 0xffff);
	const step = (MTU - 20) & ~7;
	const packets: Bytes[] = [];
	for (let offset = 0; offset < udp.length; offset += step) {
		const chunk = udp.subarray(offset, offset + step);
		const flags = (offset + step < udp.length ? 0x2000 : 0) | (offset / 8);
		const header = concat(
			Uint8Array.of(0x45, 0),
			u16be(20 + chunk.length),
			u16be(ident & 0xffff),
			u16be(flags),
			Uint8Array.of(64, PROTO_UDP),
			u16be(0),
			src,
			dst
		);
		view(header).setUint16(10, checksum(header));
		packets.push(concat(header, chunk));
	}
	return packets;
}

export interface Datagram {
	sourceIp: string;
	sourcePort: number;
	payload: Bytes;
}

/** One interface's addresses and neighbours; `deliver` takes Ethernet frames from the radio. */
export class UserspaceStack {
	ip: string | null = null;
	broadcast: string | null = null;
	readonly neighbors = new Map<string, Bytes>();
	private learned = new Map<string, Bytes>();
	private fragments = new Map<
		string,
		{ started: number; parts: Map<number, Bytes>; end: number | null }
	>();
	private ident = 0;

	constructor(
		readonly mac: Bytes,
		private transmit: (frame: Bytes) => void,
		private onDatagram: (port: number, datagram: Datagram) => void,
		private now: () => number
	) {}

	sendUdp(payload: Uint8Array, dstIp: string, dstPort: number, srcPort: number): void {
		if (!this.ip) throw new Error('the interface has no address yet');
		const target = this.resolve(dstIp);
		if (!target) {
			this.sendArp(1, BROADCAST_MAC, new Uint8Array(6), dstIp);
			return;
		}
		this.ident = (this.ident + 1) & 0xffff;
		for (const packet of buildUdp(this.ip, dstIp, srcPort, dstPort, payload, this.ident)) {
			this.transmit(concat(target, this.mac, u16be(ETHERTYPE_IP), packet));
		}
	}

	deliver(frame: Uint8Array): void {
		if (frame.length < 14) return;
		const target = frame.subarray(0, 6);
		if (!equal(target, this.mac) && !equal(target, BROADCAST_MAC) && !(target[0] & 1)) return;
		const type = readU16be(frame, 12);
		if (type === ETHERTYPE_ARP) this.onArp(frame.subarray(14));
		else if (type === ETHERTYPE_IP) this.onIp(frame);
	}

	private resolve(address: string): Bytes | null {
		if (address === '255.255.255.255' || address === this.broadcast || address.endsWith('.255')) {
			return BROADCAST_MAC;
		}
		return this.neighbors.get(address) ?? this.learned.get(address) ?? null;
	}

	private sendArp(op: number, ethTarget: Uint8Array, hwTarget: Uint8Array, ipTarget: string): void {
		if (!this.ip) return;
		const arp = concat(
			u16be(1),
			u16be(ETHERTYPE_IP),
			Uint8Array.of(6, 4),
			u16be(op),
			this.mac,
			ipBytes(this.ip),
			hwTarget,
			ipBytes(ipTarget)
		);
		this.transmit(concat(ethTarget, this.mac, u16be(ETHERTYPE_ARP), arp));
	}

	private onArp(arp: Uint8Array): void {
		if (arp.length < 28) return;
		const op = readU16be(arp, 6);
		const senderMac = arp.slice(8, 14);
		const sender = ipText(arp.subarray(14, 18));
		if (sender !== '0.0.0.0') this.learned.set(sender, senderMac);
		if (op === 1 && this.ip && ipText(arp.subarray(24, 28)) === this.ip) {
			this.sendArp(2, senderMac, senderMac, sender);
		}
	}

	private onIp(frame: Uint8Array): void {
		let ip: Uint8Array = frame.subarray(14);
		if (ip.length < 20 || ip[0] >> 4 !== 4) return;
		let ihl = (ip[0] & 0x0f) * 4;
		ip = ip.subarray(0, readU16be(ip, 2));
		const src = ipText(ip.subarray(12, 16));
		if (src !== '0.0.0.0' && !equal(frame.subarray(6, 12), this.mac) && !this.learned.has(src)) {
			this.learned.set(src, frame.slice(6, 12));
		}
		const flags = readU16be(ip, 6);
		if (flags & 0x3fff) {
			const whole = this.reassemble(ip, ihl, flags);
			if (!whole) return;
			ip = whole;
			ihl = 20;
		}
		if (ip[9] !== PROTO_UDP || ip.length < ihl + 8) return;
		const dst = ipText(ip.subarray(16, 20));
		if (
			this.ip &&
			![this.ip, this.broadcast, '255.255.255.255'].includes(dst) &&
			!dst.endsWith('.255')
		) {
			return;
		}
		const srcPort = readU16be(ip, ihl);
		const dstPort = readU16be(ip, ihl + 2);
		const udpLength = readU16be(ip, ihl + 4);
		const payload = ip.slice(ihl + 8, ihl + Math.max(udpLength, 8));
		this.onDatagram(dstPort, { sourceIp: src, sourcePort: srcPort, payload });
	}

	private reassemble(ip: Uint8Array, ihl: number, flags: number): Bytes | null {
		const key = Array.from(ip.subarray(4, 6))
			.concat(Array.from(ip.subarray(12, 20)), ip[9])
			.join(',');
		const now = this.now();
		for (const [k, v] of this.fragments)
			if (now - v.started > REASSEMBLY_TIMEOUT_MS) this.fragments.delete(k);
		const entry = this.fragments.get(key) ?? { started: now, parts: new Map(), end: null };
		const offset = (flags & 0x1fff) * 8;
		entry.parts.set(offset, ip.slice(ihl));
		if (!(flags & 0x2000)) entry.end = offset + ip.length - ihl;
		this.fragments.set(key, entry);
		if (entry.end === null) return null;
		const ordered = [...entry.parts].sort(([a], [b]) => a - b);
		let cursor = 0;
		for (const [off, part] of ordered) {
			if (off !== cursor) return null;
			cursor += part.length;
		}
		if (cursor !== entry.end) return null;
		this.fragments.delete(key);
		const data = concat(...ordered.map(([, part]) => part));
		const header = new Uint8Array(ip.subarray(0, 20));
		header[0] = 0x45;
		view(header).setUint16(2, 20 + data.length);
		view(header).setUint16(6, 0);
		return concat(header, data);
	}
}
