import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import type { EngineApi } from '$lib/engine';
import { createCapacitorFileStore } from '$lib/pksx/saves/capacitor-storage';
import { BrowserCatalogPersistence } from './browser';
import { NativeCatalogPersistence } from './native';
import { PokemonStorageService } from './service';

export { PokemonStorageService } from './service';
export type { CatalogCarrySource } from './service';
export { catalogLegacyView } from './legacy-view';
export { BrowserCatalogPersistence, deleteBrowserCatalog } from './browser';
export { NativeCatalogPersistence } from './native';
export { CatalogConflictError, POKEMON_STORAGE_CATALOG_VERSION } from './types';
export type {
	BlobReference,
	PokemonOrigin,
	Placement,
	PokemonRecord,
	StorageBox,
	DeletionTombstone,
	PokemonStorageManifest,
	CatalogPersistence
} from './types';

export function createPokemonStorageService(engine: EngineApi): PokemonStorageService {
	const persistence =
		browser && Capacitor.isNativePlatform()
			? new NativeCatalogPersistence(createCapacitorFileStore())
			: new BrowserCatalogPersistence();
	return new PokemonStorageService(persistence, engine);
}
