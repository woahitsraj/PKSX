export const controllerConnection = $state({ connected: false });

// A native connection report wins over presses and the Gamepad API; a press only infers one.
export function trackControllerConnection() {
	let native: boolean | null = null;
	const update = () => {
		controllerConnection.connected = native ?? hasGamepad();
	};
	const handleNativeInput = (event: Event) => {
		if (native !== null || !(event as CustomEvent<{ pressed?: boolean } | null>).detail?.pressed)
			return;
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
