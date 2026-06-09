import type { SaveSlotRef, SlotOperation } from '$lib/engine';

export type PendingSlotOperation = {
	kind: 'move' | 'copy';
	source: SaveSlotRef;
	sourceLabel: string;
	sourcePokemonLabel: string;
};

/**
 * Occupancy of a Slot as known to the caller. `null` means the Slot is not
 * currently visible (for example, a Box that is not active), in which case
 * occupancy checks are skipped rather than denied.
 */
export type SlotOccupancy = boolean | null;

export type DestinationContext = {
	destinationOccupied: SlotOccupancy;
	partyCount: number | null;
};

export type DestinationState = 'source' | 'valid' | 'invalid';

export type SlotOperationDenialReason =
	| 'empty-source'
	| 'occupied-destination'
	| 'invalid-party-destination';

export type SlotOperationOutcome = 'moved' | 'swapped' | 'copied' | 'cleared';

/**
 * A no-op resolves the pending Slot Operation and ends destination picking;
 * a denial keeps it active so another destination can be chosen.
 */
export type SlotOperationPlan =
	| { kind: 'no-op'; message: string; endsPendingOperation: true }
	| {
			kind: 'denied';
			reason: SlotOperationDenialReason;
			message: string;
			endsPendingOperation: false;
	  }
	| { kind: 'ready'; operation: SlotOperation; outcome: SlotOperationOutcome };

export const NO_OP_SLOT_OPERATION_MESSAGE = 'No Slot change made.';

const DENIAL_MESSAGES: Record<SlotOperationDenialReason, string> = {
	'empty-source': 'Move, Copy, and Clear Slot need an occupied source Slot.',
	'occupied-destination': 'Copy needs an empty destination Slot.',
	'invalid-party-destination': 'That Party Slot cannot be used yet.'
};

export function slotRefKey(ref: SaveSlotRef): string {
	return ref.zone === 'party' ? `party:${ref.slot}` : `box:${ref.box}:${ref.slot}`;
}

export function isSameSlotRef(a: SaveSlotRef, b: SaveSlotRef): boolean {
	return slotRefKey(a) === slotRefKey(b);
}

function isInvalidPartyDestination(
	destination: SaveSlotRef,
	destinationOccupied: SlotOccupancy,
	partyCount: number | null
): boolean {
	return (
		destination.zone === 'party' &&
		destinationOccupied === false &&
		partyCount !== null &&
		destination.slot > partyCount
	);
}

export function classifyDestination(
	pending: Pick<PendingSlotOperation, 'kind' | 'source'>,
	destination: SaveSlotRef,
	context: DestinationContext
): DestinationState {
	if (isSameSlotRef(destination, pending.source)) {
		return 'source';
	}

	if (pending.kind === 'copy' && context.destinationOccupied === true) {
		return 'invalid';
	}

	if (isInvalidPartyDestination(destination, context.destinationOccupied, context.partyCount)) {
		return 'invalid';
	}

	return 'valid';
}

function denied(reason: SlotOperationDenialReason): SlotOperationPlan {
	return { kind: 'denied', reason, message: DENIAL_MESSAGES[reason], endsPendingOperation: false };
}

export type PlanSlotOperationInput = {
	kind: 'move' | 'copy';
	source: SaveSlotRef;
	sourceOccupied: SlotOccupancy;
	destination: SaveSlotRef;
	destinationOccupied: SlotOccupancy;
	partyCount: number | null;
};

export function planSlotOperation(input: PlanSlotOperationInput): SlotOperationPlan {
	if (isSameSlotRef(input.source, input.destination)) {
		return { kind: 'no-op', message: NO_OP_SLOT_OPERATION_MESSAGE, endsPendingOperation: true };
	}

	if (input.kind === 'copy' && input.destinationOccupied === true) {
		return denied('occupied-destination');
	}

	if (isInvalidPartyDestination(input.destination, input.destinationOccupied, input.partyCount)) {
		return denied('invalid-party-destination');
	}

	if (input.sourceOccupied === false) {
		return denied('empty-source');
	}

	const operation: SlotOperation = {
		kind: input.kind,
		source: input.source,
		destination: input.destination
	};

	return {
		kind: 'ready',
		operation,
		outcome:
			input.kind === 'copy' ? 'copied' : input.destinationOccupied === true ? 'swapped' : 'moved'
	};
}

export type PlanClearSlotInput = {
	source: SaveSlotRef;
	sourceOccupied: SlotOccupancy;
};

export function planClearSlotOperation(input: PlanClearSlotInput): SlotOperationPlan {
	if (input.sourceOccupied === false) {
		return denied('empty-source');
	}

	return {
		kind: 'ready',
		operation: { kind: 'clear', source: input.source },
		outcome: 'cleared'
	};
}

export function successMessageForSlotOperation(
	outcome: SlotOperationOutcome,
	locationLabel: string
): string {
	switch (outcome) {
		case 'cleared':
			return `Cleared ${locationLabel}.`;
		case 'copied':
			return `Copied to ${locationLabel}.`;
		case 'swapped':
			return `Swapped with ${locationLabel}.`;
		case 'moved':
			return `Moved to ${locationLabel}.`;
	}
}
