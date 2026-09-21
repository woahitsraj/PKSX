import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { SaveFileLegalityResult } from '$lib/pksx/save-file-legality-report';
import type { SaveFileLegalityReportViewState } from '$lib/pksx/save-file-legality-report/host.svelte';
import SaveFileLegalityReport from './SaveFileLegalityReport.svelte';

let component: ReturnType<typeof mount> | null = null;

afterEach(async () => {
	if (component) await unmount(component);
	component = null;
	document.body.replaceChildren();
});

describe('Save File Legality Report batch action', () => {
	test('shows proposed changes and unfixable reasons before pointer Apply', async () => {
		const onApplyFixes = vi.fn();
		render(readyState('preview-ready'), { onApplyFixes });

		expect(document.body.textContent).toContain('1 supported, 1 could not be included.');
		expect(document.body.textContent).toContain('Move 1: Splash to Thunder Shock');
		expect(document.body.textContent).toContain('No supported Legality Fix is available.');
		expect(document.body.textContent).toContain('Warnings and Fishy results stay unchanged.');

		button('Apply 1 supported fix').click();
		expect(onApplyFixes).toHaveBeenCalledOnce();
	});

	test('applies from Controller Focus and cancels an in-flight batch from pointer input', async () => {
		const onApplyFixes = vi.fn();
		const onCancel = vi.fn();
		render(readyState('preview-ready'), { onApplyFixes, onCancel });
		const apply = button('Apply 1 supported fix');
		apply.focus();
		apply.dispatchEvent(new FocusEvent('focus'));
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(onApplyFixes).toHaveBeenCalledOnce();

		await unmount(component!);
		component = null;
		document.body.replaceChildren();
		render(readyState('applying'), { onApplyFixes, onCancel });
		button('Cancel batch').click();
		expect(onCancel).toHaveBeenCalledOnce();
	});

	test('makes the final commit phase busy and uncancellable', () => {
		const onCancel = vi.fn();
		render(readyState('committing'), { onCancel });

		expect(button('Saving batch').disabled).toBe(true);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(onCancel).not.toHaveBeenCalled();
	});

	test('shows per-Pokemon applied changes and the successful outcome', () => {
		render(readyState('applied'));

		expect(document.body.textContent).toContain('Applied Legality Fixes');
		expect(document.body.textContent).toContain('All supported fixes succeeded.');
		expect(document.body.textContent).toContain('Move 1: Splash to Thunder Shock');
		expect(document.body.textContent).toContain('No supported Legality Fix is available.');
	});
});

function render(
	state: SaveFileLegalityReportViewState,
	overrides: Partial<{
		onApplyFixes: () => void;
		onCancel: () => void;
	}> = {}
) {
	component = mount(SaveFileLegalityReport, {
		target: document.body,
		props: {
			fileName: 'main.sav',
			state,
			onRun: vi.fn(),
			onPreviewFixes: vi.fn(),
			onApplyFixes: overrides.onApplyFixes ?? vi.fn(),
			onCancel: overrides.onCancel ?? vi.fn(),
			onClose: vi.fn(),
			onJumpToSlot: vi.fn(async () => true),
			onOpenPokemonReport: vi.fn(async () => true)
		}
	});
	flushSync();
	void tick();
}

function readyState(
	status: 'preview-ready' | 'applying' | 'committing' | 'applied'
): SaveFileLegalityReportViewState {
	const entries = [
		{
			result: legalityResult('Pikachu', 0),
			status: status === 'applied' ? ('applied' as const) : ('fixable' as const),
			operation: { kind: 'legality-fix' as const, choiceId: 'fix:1' },
			changes: [{ field: 'Move 1', before: 'Splash', after: 'Thunder Shock' }]
		},
		{
			result: legalityResult('Mew', 1),
			status: 'unfixable' as const,
			reason: 'No supported Legality Fix is available.'
		}
	];
	return {
		status: 'ready',
		results: [legalityResult('Pikachu', 0), legalityResult('Mew', 1)],
		stale: status === 'applied',
		batch: { status, entries }
	} as SaveFileLegalityReportViewState;
}

function legalityResult(pokemonLabel: string, slot: number): SaveFileLegalityResult {
	return {
		id: `party:${slot}`,
		source: { zone: 'party', slot },
		location: `Party, Slot ${slot + 1}`,
		pokemonLabel,
		speciesName: pokemonLabel,
		classification: 'illegal',
		firstIssue: 'Example issue.',
		report: {
			legal: false,
			judgement: 'Illegal',
			summary: 'This Pokemon has legality issues.',
			fixableProblems: [],
			warnings: [],
			messages: []
		}
	};
}

function button(name: string) {
	const match = [...document.querySelectorAll('button')].find(
		(candidate) =>
			candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name
	);
	if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${name}`);
	return match;
}
