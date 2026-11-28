import { getContext, setContext } from 'svelte';
import type { QuickSearchResult } from '.';
import type { UnavailableCriteria } from './advanced';

const quickSearchHostKey = Symbol('pksx-quick-search-host');

export type QuickSearchSaveFile = {
	scope: 'save-file' | 'pokemon-storage';
	fileName: string;
	isAvailable(): Promise<boolean>;
	loadResults(options?: { includeLegality?: boolean }): Promise<QuickSearchCollection>;
	focusResult(result: QuickSearchResult): Promise<string | null>;
};

export type QuickSearchCollection = {
	results: QuickSearchResult[];
	unavailable: UnavailableCriteria;
};

export type QuickSearchProvider = {
	captureActiveSaveFile(): QuickSearchSaveFile | null;
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
