<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppUpdatePrompt from '$lib/components/pksx/AppUpdatePrompt.svelte';
	import MobileTabbar from '$lib/components/pksx/MobileTabbar.svelte';
	import TopBar from '$lib/components/pksx/TopBar.svelte';
	import { appChrome } from '$lib/pksx/app-chrome.svelte';

	let { children } = $props();

	const sectionPills = ['Boxes', 'Saves'];
	const mobileTabs = [
		{ key: 'boxes', label: 'Boxes', glyph: '▦' },
		{ key: 'saves', label: 'Saves', glyph: '☁' }
	];

	let darkMode = $state(false);
	let chromeFocus = $state<{ zone: 'topbar' | 'mobileTabs'; index: number } | null>(null);
	const activeRoute = $derived(page.url.pathname.startsWith('/saves') ? 'saves' : 'boxes');
	const activeSection = $derived(activeRoute === 'saves' ? 'Saves' : 'Boxes');

	function openBoxes() {
		void goto(resolve('/'));
	}

	function openSaves() {
		void goto(resolve('/saves'));
	}

	function handleImport(file: File) {
		appChrome.importSave?.(file);
	}

	function handleExport() {
		appChrome.exportSave?.();
	}

	function focusTopControl(index: number) {
		chromeFocus = { zone: 'topbar', index };
	}

	function focusMobileTab(index: number) {
		chromeFocus = { zone: 'mobileTabs', index };
	}

	function selectMobileTab(index: number) {
		chromeFocus = { zone: 'mobileTabs', index };
		const tab = mobileTabs[index];
		if (tab?.key === 'boxes') {
			openBoxes();
		}
		if (tab?.key === 'saves') {
			openSaves();
		}
	}

	function handleChromeKeydown(event: KeyboardEvent) {
		if (appChrome.controllerInputActive) {
			return;
		}

		const action = keyboardAction(event);
		if (!action) {
			return;
		}

		if (!chromeFocus) {
			chromeFocus = { zone: 'topbar', index: 0 };
		}

		event.preventDefault();
		dispatchChromeAction(action);
	}

	function chromeGamepadNavigation() {
		if (typeof navigator === 'undefined' || typeof requestAnimationFrame === 'undefined') {
			return;
		}

		let previousPressed: Array<'previous' | 'next' | 'confirm'> = [];
		let frame = 0;

		const read = () => {
			if (!appChrome.controllerInputActive) {
				const gamepad = navigator.getGamepads().find((pad) => pad);
				const pressed = gamepad ? readGamepadActions(gamepad) : [];

				for (const action of pressed) {
					if (!previousPressed.includes(action)) {
						dispatchChromeAction(action);
					}
				}

				previousPressed = pressed;
			}

			frame = requestAnimationFrame(read);
		};

		frame = requestAnimationFrame(read);

		return () => cancelAnimationFrame(frame);
	}

	function dispatchChromeAction(action: 'previous' | 'next' | 'confirm') {
		if (!chromeFocus) {
			chromeFocus = { zone: 'mobileTabs', index: activeRoute === 'saves' ? 1 : 0 };
		}

		if (chromeFocus.zone === 'topbar') {
			const nextIndex = nextChromeIndex(chromeFocus.index, action, 5);
			chromeFocus = { zone: 'topbar', index: nextIndex };
			focusChromeElement(`top-control-${nextIndex}`);
			if (action === 'confirm') {
				activateTopControl(nextIndex);
			}
			return;
		}

		const nextIndex = nextChromeIndex(chromeFocus.index, action, mobileTabs.length);
		chromeFocus = { zone: 'mobileTabs', index: nextIndex };
		focusChromeElement(`mobile-tab-${nextIndex}`);
		if (action === 'confirm') {
			selectMobileTab(nextIndex);
		}
	}

	function readGamepadActions(gamepad: Gamepad): Array<'previous' | 'next' | 'confirm'> {
		const actions: Array<'previous' | 'next' | 'confirm'> = [];
		const axisX = gamepad.axes[0] ?? 0;
		const axisY = gamepad.axes[1] ?? 0;

		if (isPressed(gamepad, 14) || isPressed(gamepad, 12) || axisX < -0.55 || axisY < -0.55) {
			actions.push('previous');
		}
		if (isPressed(gamepad, 15) || isPressed(gamepad, 13) || axisX > 0.55 || axisY > 0.55) {
			actions.push('next');
		}
		if (isPressed(gamepad, 0)) {
			actions.push('confirm');
		}

		return actions;
	}

	function isPressed(gamepad: Gamepad, index: number) {
		return gamepad.buttons[index]?.pressed === true;
	}

	function keyboardAction(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowUp':
				return 'previous';
			case 'ArrowRight':
			case 'ArrowDown':
				return 'next';
			case 'Enter':
			case ' ':
				return 'confirm';
			default:
				return null;
		}
	}

	function nextChromeIndex(index: number, action: 'previous' | 'next' | 'confirm', count: number) {
		if (action === 'previous') {
			return (index + count - 1) % count;
		}
		if (action === 'next') {
			return (index + 1) % count;
		}
		return index;
	}

	function activateTopControl(index: number) {
		if (index === 0) openBoxes();
		if (index === 1) openSaves();
		if (index === 2 && !appChrome.busy) document.getElementById('quick-save-import')?.click();
		if (index === 3 && appChrome.hasLoadedSave && !appChrome.busy) handleExport();
		if (index === 4) darkMode = !darkMode;
	}

	function focusChromeElement(id: string) {
		queueMicrotask(() => document.getElementById(id)?.focus());
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:window onkeydown={handleChromeKeydown} />

<main
	class={['app-shell', darkMode && 'dark']}
	aria-labelledby="screen-title"
	{@attach chromeGamepadNavigation}
>
	<TopBar
		{sectionPills}
		{activeSection}
		saveSummary={appChrome.saveSummary}
		boxCount={appChrome.boxCount}
		activeBox={appChrome.activeBox}
		fileName={appChrome.fileName}
		busy={appChrome.busy}
		hasLoadedSave={appChrome.hasLoadedSave}
		{darkMode}
		focusIndex={chromeFocus?.zone === 'topbar' ? chromeFocus.index : null}
		onFocusControl={focusTopControl}
		onOpenBoxes={openBoxes}
		onOpenSaves={openSaves}
		onImport={handleImport}
		onExport={handleExport}
		onToggleTheme={() => (darkMode = !darkMode)}
	/>

	{@render children()}

	<MobileTabbar
		tabs={mobileTabs}
		activeKey={activeRoute}
		focusIndex={chromeFocus?.zone === 'mobileTabs' ? chromeFocus.index : null}
		onFocusTab={focusMobileTab}
		onSelectTab={selectMobileTab}
	/>
</main>
<AppUpdatePrompt />
