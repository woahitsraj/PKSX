import { describe, expect, it } from 'vitest';
import { classify, type TradeEvidence } from './session';

const offered = new Uint8Array(0x158);
const none: TradeEvidence = {
	offered: null,
	consoleConfirmed: false,
	ladderStarted: false,
	ladderPhase: null,
	ladderFinished: false
};
const received = { ...none, offered };
const confirmed = { ...received, consoleConfirmed: true };
const finished = { ...confirmed, ladderStarted: true, ladderPhase: 4, ladderFinished: true };

describe('the trade outcome', () => {
	it('never treats a received offer as a completed trade', () => {
		expect(classify('connection-lost', received)).toEqual({
			outcome: 'failed',
			code: 'connection-lost'
		});
		expect(classify('console-left', received)).toEqual({ outcome: 'cancelled' });
		expect(classify('cancelled', received)).toEqual({ outcome: 'cancelled' });
	});

	it('completes only after phase 4 and a graceful end', () => {
		expect(classify('console-left', finished)).toEqual({
			outcome: 'completed',
			endedBy: 'console-left'
		});
		expect(classify('console-offered-again', finished)).toEqual({
			outcome: 'completed',
			endedBy: 'console-offered-again'
		});
	});

	it('keeps any interruption after the console confirms as an Unknown Trade Outcome', () => {
		for (const end of [
			'radio-lost',
			'connection-lost',
			'cancelled',
			'ladder-stalled',
			'timed-out'
		] as const) {
			expect(classify(end, confirmed)).toEqual({ outcome: 'outcome-unknown', reason: end });
			expect(classify(end, finished)).toEqual({ outcome: 'outcome-unknown', reason: end });
		}
	});

	it('reports a console that never accepted as not ready', () => {
		expect(classify('console-not-ready', none)).toEqual({
			outcome: 'failed',
			code: 'console-not-ready'
		});
	});
});
