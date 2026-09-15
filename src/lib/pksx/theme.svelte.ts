const storageKey = 'pksx-theme';

class ThemeState {
	dark = $state(false);

	restore() {
		this.dark = document.documentElement.dataset.pksxTheme === 'dark';
	}

	setDark(dark: boolean) {
		this.dark = dark;
		document.documentElement.dataset.pksxTheme = dark ? 'dark' : 'light';
		try {
			localStorage.setItem(storageKey, dark ? 'dark' : 'light');
		} catch {
			// Keep the in-memory preference when storage is unavailable.
		}
	}

	toggle() {
		this.setDark(!this.dark);
	}
}

export const theme = new ThemeState();
