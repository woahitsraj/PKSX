export type ControllerKey =
	| 'ArrowUp'
	| 'ArrowDown'
	| 'ArrowLeft'
	| 'ArrowRight'
	| 'Enter'
	| 'Escape'
	| 'PageUp'
	| 'PageDown'
	| 'y';

export function readGamepadKeys(gamepad: Gamepad): ControllerKey[] {
	const keys: ControllerKey[] = [];
	const axisX = gamepad.axes[0] ?? 0;
	const axisY = gamepad.axes[1] ?? 0;

	if (pressed(gamepad, 12) || axisY < -0.55) keys.push('ArrowUp');
	if (pressed(gamepad, 13) || axisY > 0.55) keys.push('ArrowDown');
	if (pressed(gamepad, 14) || axisX < -0.55) keys.push('ArrowLeft');
	if (pressed(gamepad, 15) || axisX > 0.55) keys.push('ArrowRight');

	if (gamepad.mapping !== 'standard' && gamepad.axes.length > 9) {
		for (const key of readHatAxis(gamepad.axes[9] ?? 4)) {
			if (!keys.includes(key)) keys.push(key);
		}
	}

	if (pressed(gamepad, 0)) keys.push('Enter');
	if (pressed(gamepad, 1)) keys.push('Escape');
	if (pressed(gamepad, 3)) keys.push('y');
	if (pressed(gamepad, 4)) keys.push('PageUp');
	if (pressed(gamepad, 5)) keys.push('PageDown');

	return keys;
}

function readHatAxis(value: number): ControllerKey[] {
	if (value < -1.05 || value > 1.05) return [];

	const position = Math.round((value + 1) * 3.5) % 8;
	const keys: ControllerKey[] = [];

	if (position === 0 || position === 1 || position === 7) keys.push('ArrowUp');
	if (position >= 1 && position <= 3) keys.push('ArrowRight');
	if (position >= 3 && position <= 5) keys.push('ArrowDown');
	if (position >= 5 && position <= 7) keys.push('ArrowLeft');

	return keys;
}

function pressed(gamepad: Gamepad, index: number) {
	return gamepad.buttons[index]?.pressed === true;
}
