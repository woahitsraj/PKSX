import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { CapacitorSavesStorage } from './capacitor-storage';
import { IndexedDbSavesStorage } from './indexed-db-storage';
import type { SavesStorage } from './types';

export function createSavesStorage(
	isNativePlatform = browser && Capacitor.isNativePlatform()
): SavesStorage {
	return isNativePlatform ? new CapacitorSavesStorage() : new IndexedDbSavesStorage();
}
