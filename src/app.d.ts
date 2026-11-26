// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** Published PKHeX Engine folder, set by Vite from `static/pkhex-engine`. */
	const __PKHEX_ENGINE_BASE_PATH__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
