import { getContext, setContext } from 'svelte';
import type { QuickSearchResult } from '.';

const quickSearchHostKey = Symbol('pksx-quick-search-host');

export type QuickSearchCollection = {
	label: string;
	isAvailable(): Promise<boolean>;
	loadResults(): Promise<QuickSearchResult[]>;
	focusResult(result: QuickSearchResult): Promise<string | null>;
};

export type QuickSearchProvider = {
	captureFocusedCollection(): QuickSearchCollection | null;
};

export type QuickSearchHost = {
	register(provider: QuickSearchProvider): () => void;
	getProvider(): QuickSearchProvider | null;
};

export function createQuickSearchHost(): QuickSearchHost {
	let current: QuickSearchProvider | null = null;

	return {
		register(provider) {
			current = provider;
			return () => {
				if (current === provider) current = null;
			};
		},
		getProvider() {
			return current;
		}
	};
}

export function setQuickSearchHost(host: QuickSearchHost) {
	return setContext(quickSearchHostKey, host);
}

export function getQuickSearchHost() {
	return getContext<QuickSearchHost>(quickSearchHostKey);
}
