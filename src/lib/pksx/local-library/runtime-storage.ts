import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { CapacitorLocalLibraryStorage } from './capacitor-storage';
import { IndexedDbLocalLibraryStorage } from './indexed-db-storage';
import type { LocalLibraryStorage } from './types';

export function createLocalLibraryStorage(
	isNativePlatform = browser && Capacitor.isNativePlatform()
): LocalLibraryStorage {
	return isNativePlatform ? new CapacitorLocalLibraryStorage() : new IndexedDbLocalLibraryStorage();
}
