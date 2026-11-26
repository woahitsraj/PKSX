export const controllerConnection = $state({ connected: false });

// Native bridges report connection state; once one reports, it wins over the Gamepad API.
export function trackControllerConnection() {
	let native: boolean | null = null;
	const update = () => {
		controllerConnection.connected = native ?? hasGamepad();
	};
	const handleNativeInput = (event: Event) => {
		if (!(event as CustomEvent<{ pressed?: boolean } | null>).detail?.pressed) return;
		native = true;
		update();
	};
	const handleNativeConnection = (event: Event) => {
		native = (event as CustomEvent<{ connected?: boolean } | null>).detail?.connected !== false;
		update();
	};

	window.addEventListener('gamepadconnected', update);
	window.addEventListener('gamepaddisconnected', update);
	window.addEventListener('pksxcontroller', handleNativeInput);
	window.addEventListener('pksxcontrollerconnection', handleNativeConnection);
	update();

	return () => {
		window.removeEventListener('gamepadconnected', update);
		window.removeEventListener('gamepaddisconnected', update);
		window.removeEventListener('pksxcontroller', handleNativeInput);
		window.removeEventListener('pksxcontrollerconnection', handleNativeConnection);
	};
}

function hasGamepad() {
	try {
		return navigator.getGamepads?.().some(Boolean) ?? false;
	} catch {
		return false;
	}
}
