import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	if (!building && url.searchParams.get('source') === 'pokemon-storage') {
		redirect(307, '/boxes?source=pokemon-storage');
	}
};
