import type { TradeEntry } from './trade-journal';

export function tradeProgress(entry: TradeEntry): string {
	const phase = entry.events.findLast((event) => event.type === 'session-phase');
	if (phase?.type !== 'session-phase') return 'Starting trade';
	switch (phase.phase) {
		case 'scanning':
			return 'Looking for the Switch';
		case 'joining':
			return 'Connecting to the Switch';
		case 'waiting-for-console':
			return 'Waiting for the Switch';
		case 'in-trade-room':
			return 'Choose a Pokemon on the Switch';
		case 'offer-received':
			return 'Confirm on the Switch';
		case 'confirming':
			return 'Trading Pokemon';
		case 'finishing':
			return 'Finishing trade';
	}
}
export function tradeOutcomeMessage(entry: TradeEntry): string {
	switch (entry.outcome) {
		case 'completed':
			return 'Trade completed';
		case 'cancelled':
			return 'Trade cancelled';
		case 'outcome-unknown':
			return 'Unknown Trade Outcome';
		default:
			return entry.error?.code === 'console-not-ready'
				? "Switch isn't ready"
				: 'Could not join the Switch';
	}
}
