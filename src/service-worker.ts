/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `pksx-${version}`;
const debugAssetPattern = /\.(map|symbols)$/;
const assets = [...build, ...files.filter((file) => !isSkippedAsset(file))];

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(cacheName).then((cache) => {
			return cache.addAll(assets);
		})
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
		})
	);
});

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	event.respondWith(fetchWithCacheFallback(event.request));
});

async function fetchWithCacheFallback(request: Request): Promise<Response> {
	const cache = await caches.open(cacheName);
	const url = new URL(request.url);

	if (assets.includes(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) {
			return cached;
		}
	}

	try {
		const response = await fetch(request);

		if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
			await cache.put(request, response.clone());
		}

		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}

		throw error;
	}
}

function isSkippedAsset(file: string): boolean {
	const fileName = file.split('/').at(-1) ?? file;

	return debugAssetPattern.test(file) || fileName.startsWith('.');
}
