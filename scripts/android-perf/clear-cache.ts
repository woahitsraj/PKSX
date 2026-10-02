// Removes the service worker and its cache, so the app runs the installed build. Saves are kept.
import { connect } from './cdp.ts';

const cdp = await connect();
try {
	const origin = await cdp.evaluate<string>('location.origin');
	await cdp.send('Storage.clearDataForOrigin', {
		origin,
		storageTypes: 'service_workers,cache_storage'
	});
	await cdp.evaluate('location.reload()');
	console.log('Cleared the service worker and cache for', origin);
} finally {
	cdp.close();
}
