import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export const prerender = false;

/** A dev-only rig for the Install firmware flow; #369 owns the product entry. */
export function load() {
	if (!dev) error(404, 'Not found');
}
