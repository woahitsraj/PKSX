export type FocusTarget = HTMLElement | string | null | undefined;

export type FocusRequestOptions = FocusOptions & {
	/** Runs when the target is missing and its region has no enabled control. */
	orElse?: () => void;
};

const regionSelector =
	'[data-focus-region], [role="dialog"], [role="alertdialog"], [role="menu"], [role="list"], [role="grid"], form';
const controlSelector = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]';

let latestRequest = 0;

/** The one path that moves DOM focus. The latest request wins and cancels any pending request. */
export function requestFocus(
	target: FocusTarget | (() => FocusTarget),
	{ orElse, ...options }: FocusRequestOptions = {}
) {
	const request = ++latestRequest;
	queueMicrotask(() => {
		if (request !== latestRequest) return;
		const resolved = typeof target === 'function' ? target() : target;
		const element = typeof resolved === 'string' ? document.getElementById(resolved) : resolved;
		const control = element && (isEnabled(element) ? element : nearestEnabledControl(element));
		if (control) control.focus(options);
		else orElse?.();
	});
}

function isEnabled(element: HTMLElement) {
	return !element.matches(':disabled') && !element.closest('[inert]');
}

function nearestEnabledControl(target: HTMLElement) {
	let region: HTMLElement | null = target.closest<HTMLElement>(regionSelector) ?? document.body;
	while (region) {
		const controls = Array.from(region.querySelectorAll<HTMLElement>(controlSelector)).filter(
			(control) => control !== target && isEnabled(control) && control.checkVisibility()
		);
		const next = controls.find(
			(control) => target.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING
		);
		if (next ?? controls.at(-1)) return next ?? controls.at(-1)!;
		region =
			region === document.body
				? null
				: (region.parentElement?.closest<HTMLElement>(regionSelector) ?? document.body);
	}
	return null;
}
