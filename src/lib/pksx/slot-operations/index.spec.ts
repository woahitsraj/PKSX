import { describe, expect, it } from 'vitest';
import {
	classifyDestination,
	isSameSlotRef,
	NO_OP_SLOT_OPERATION_MESSAGE,
	planClearSlotOperation,
	planSlotOperation,
	slotRefKey,
	successMessageForSlotOperation
} from './index';
import type { SaveSlotRef } from '$lib/engine';

const boxSlot = (box: number, slot: number): SaveSlotRef => ({ zone: 'box', box, slot });
const partySlot = (slot: number): SaveSlotRef => ({ zone: 'party', slot });

describe('slotRefKey', () => {
	it('distinguishes party slots, box slots, and boxes', () => {
		expect(slotRefKey(partySlot(2))).toBe('party:2');
		expect(slotRefKey(boxSlot(0, 2))).toBe('box:0:2');
		expect(slotRefKey(boxSlot(1, 2))).not.toBe(slotRefKey(boxSlot(0, 2)));
	});

	it('treats equal refs as the same slot', () => {
		expect(isSameSlotRef(boxSlot(3, 7), boxSlot(3, 7))).toBe(true);
		expect(isSameSlotRef(partySlot(0), boxSlot(0, 0))).toBe(false);
	});
});

describe('planSlotOperation', () => {
	it('plans a move into an empty destination as moved', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: boxSlot(0, 5),
			destinationOccupied: false,
			partyCount: 3
		});

		expect(plan).toEqual({
			kind: 'ready',
			operation: { kind: 'move', source: boxSlot(0, 0), destination: boxSlot(0, 5) },
			outcome: 'moved'
		});
	});

	it('plans a move into an occupied destination as a Slot Swap', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: partySlot(1),
			destinationOccupied: true,
			partyCount: 3
		});

		expect(plan.kind).toBe('ready');
		expect(plan.kind === 'ready' && plan.outcome).toBe('swapped');
	});

	it('plans a copy into an empty destination as copied', () => {
		const plan = planSlotOperation({
			kind: 'copy',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: boxSlot(1, 4),
			destinationOccupied: false,
			partyCount: 3
		});

		expect(plan.kind).toBe('ready');
		expect(plan.kind === 'ready' && plan.outcome).toBe('copied');
	});

	it('resolves choosing the source slot as a no-op that ends destination picking', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(2, 9),
			sourceOccupied: true,
			destination: boxSlot(2, 9),
			destinationOccupied: true,
			partyCount: null
		});

		expect(plan).toEqual({
			kind: 'no-op',
			message: NO_OP_SLOT_OPERATION_MESSAGE,
			endsPendingOperation: true
		});
	});

	it('denies a copy into an occupied destination and keeps the operation pending', () => {
		const plan = planSlotOperation({
			kind: 'copy',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: boxSlot(0, 1),
			destinationOccupied: true,
			partyCount: 3
		});

		expect(plan).toEqual({
			kind: 'denied',
			reason: 'occupied-destination',
			message: 'Copy needs an empty destination Slot.',
			endsPendingOperation: false
		});
	});

	it('allows a move into an occupied destination where a copy is denied', () => {
		const move = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: boxSlot(0, 1),
			destinationOccupied: true,
			partyCount: 3
		});

		expect(move.kind).toBe('ready');
	});

	it('denies an empty party destination beyond the append position', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: partySlot(4),
			destinationOccupied: false,
			partyCount: 3
		});

		expect(plan).toEqual({
			kind: 'denied',
			reason: 'invalid-party-destination',
			message: 'That Party Slot cannot be used yet.',
			endsPendingOperation: false
		});
	});

	it('allows the party append position as a destination', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: partySlot(3),
			destinationOccupied: false,
			partyCount: 3
		});

		expect(plan.kind).toBe('ready');
	});

	it('skips the party restriction when no party count is known', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: true,
			destination: partySlot(5),
			destinationOccupied: false,
			partyCount: null
		});

		expect(plan.kind).toBe('ready');
	});

	it('denies an empty source slot', () => {
		const plan = planSlotOperation({
			kind: 'move',
			source: boxSlot(0, 0),
			sourceOccupied: false,
			destination: boxSlot(0, 1),
			destinationOccupied: false,
			partyCount: 3
		});

		expect(plan).toEqual({
			kind: 'denied',
			reason: 'empty-source',
			message: 'Move, Copy, and Clear Slot need an occupied source Slot.',
			endsPendingOperation: false
		});
	});

	it('reports the destination problem before the source problem, matching the existing flow', () => {
		const plan = planSlotOperation({
			kind: 'copy',
			source: boxSlot(0, 0),
			sourceOccupied: false,
			destination: boxSlot(0, 1),
			destinationOccupied: true,
			partyCount: 3
		});

		expect(plan.kind === 'denied' && plan.reason).toBe('occupied-destination');
	});

	it('treats unknown occupancy as unrestricted', () => {
		const plan = planSlotOperation({
			kind: 'copy',
			source: boxSlot(0, 0),
			sourceOccupied: null,
			destination: boxSlot(1, 1),
			destinationOccupied: null,
			partyCount: 3
		});

		expect(plan.kind).toBe('ready');
	});
});

describe('planClearSlotOperation', () => {
	it('plans a clear for an occupied source', () => {
		const plan = planClearSlotOperation({ source: boxSlot(0, 0), sourceOccupied: true });

		expect(plan).toEqual({
			kind: 'ready',
			operation: { kind: 'clear', source: boxSlot(0, 0) },
			outcome: 'cleared'
		});
	});

	it('denies clearing an empty source', () => {
		const plan = planClearSlotOperation({ source: partySlot(2), sourceOccupied: false });

		expect(plan.kind === 'denied' && plan.reason).toBe('empty-source');
	});
});

describe('classifyDestination', () => {
	const pendingMove = { kind: 'move' as const, source: boxSlot(0, 0) };
	const pendingCopy = { kind: 'copy' as const, source: boxSlot(0, 0) };

	it('marks the source slot', () => {
		expect(
			classifyDestination(pendingMove, boxSlot(0, 0), {
				destinationOccupied: true,
				partyCount: 3
			})
		).toBe('source');
	});

	it('marks occupied slots invalid for copy but valid for move', () => {
		const context = { destinationOccupied: true, partyCount: 3 };
		expect(classifyDestination(pendingCopy, boxSlot(0, 1), context)).toBe('invalid');
		expect(classifyDestination(pendingMove, boxSlot(0, 1), context)).toBe('valid');
	});

	it('marks empty party slots beyond the append position invalid', () => {
		const context = { destinationOccupied: false, partyCount: 3 };
		expect(classifyDestination(pendingMove, partySlot(4), context)).toBe('invalid');
		expect(classifyDestination(pendingMove, partySlot(3), context)).toBe('valid');
	});
});

describe('successMessageForSlotOperation', () => {
	it('names the outcome in domain language', () => {
		expect(successMessageForSlotOperation('moved', 'Box 2 Slot 3')).toBe('Moved to Box 2 Slot 3.');
		expect(successMessageForSlotOperation('swapped', 'Party Slot 1')).toBe(
			'Swapped with Party Slot 1.'
		);
		expect(successMessageForSlotOperation('copied', 'Box 1 Slot 1')).toBe(
			'Copied to Box 1 Slot 1.'
		);
		expect(successMessageForSlotOperation('cleared', 'Box 1 Slot 1')).toBe('Cleared Box 1 Slot 1.');
	});
});
