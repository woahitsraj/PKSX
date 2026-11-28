export type SpriteStyle = 'home' | 'game';

const storageKey = 'pksx-sprite-style';

class SpriteStyleState {
	current = $state<SpriteStyle>('home');

	restore() {
		try {
			this.current = localStorage.getItem(storageKey) === 'game' ? 'game' : 'home';
		} catch {
			this.current = 'home';
		}
	}

	set(style: SpriteStyle) {
		this.current = style;
		try {
			localStorage.setItem(storageKey, style);
		} catch {
			// Keep the in-memory preference when storage is unavailable.
		}
	}
}

export const spriteStyle = new SpriteStyleState();
