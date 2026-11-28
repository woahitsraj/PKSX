import { expect, test } from 'vitest';
import { createPkhexEngine } from './pkhex-engine';
import fixtureUrl from '../../../test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-legends-arceus-2025-03-24-main.sav?url';

const file = 'pokemon-legends-arceus-2025-03-24-main.sav';
const shinx = 403;

test('Legends: Arceus Pokedex research edits, reports and exports', async () => {
	const engine = await createPkhexEngine();
	const bytes = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
	const loaded = await engine.loadSaveWorkspace(bytes, file, 0);
	if (!loaded.ok) throw new Error(loaded.error.message);
	const dex = loaded.value.saveFile?.pokedex;
	expect(dex?.status).toBe('available');
	// Only the Hisui Pokedex is listed, and every species reports its research.
	expect(dex?.species).toHaveLength(242);
	expect(dex?.species.every((s) => s.research)).toBe(true);
	const before = dex?.species.find((s) => s.id === shinx);
	expect(before).toMatchObject({ seen: true, caught: true });
	expect(before?.research).toMatchObject({ level: 0, pending: 40, complete: false });
	const tasks = before?.research?.tasks ?? [];
	const defeated = tasks.findIndex((t) => t.label === 'Number defeated');
	const forms = tasks.findIndex((t) => !t.editable);
	expect(tasks[defeated]).toMatchObject({ value: 0, goals: [1, 2, 4, 10, 15], points: 10 });
	expect(tasks[forms].label).toBe('Number of different forms you’ve obtained');

	const edit = async (
		from: Uint8Array,
		pokedex: Parameters<typeof engine.applySaveFileEditOperation>[2]['pokedex']
	) => engine.applySaveFileEditOperation(from, file, { pokedex }, 0);
	for (const rejected of [
		{ kind: 'research', species: shinx, task: forms, value: 2 },
		{ kind: 'research', species: shinx, task: defeated, value: 60001 },
		{ kind: 'research', species: shinx, task: defeated, value: -1 },
		{ kind: 'research', species: shinx, task: tasks.length, value: 1 },
		{ kind: 'research', species: 1, task: 0, value: 1 },
		{ kind: 'seen', species: shinx, seen: false }
	] as const)
		expect((await edit(bytes, rejected)).ok).toBe(false);
	const same = await edit(bytes, { kind: 'research', species: shinx, task: defeated, value: 0 });
	expect(same.ok && same.value.mutated).toBe(false);

	const changed = await edit(bytes, { kind: 'research', species: shinx, task: defeated, value: 4 });
	if (!changed.ok) throw new Error(changed.error.message);
	expect(changed.value.mutated).toBe(true);
	const edited = changed.value.workspace.saveFile?.pokedex?.species.find((s) => s.id === shinx);
	// Three new goals at 10 points each wait for the next report.
	expect(edited?.research).toMatchObject({ level: 0, pending: 70 });
	expect(edited).toMatchObject({ seen: true, caught: true });

	const reported = await edit(changed.value.bytes, { kind: 'report', species: shinx });
	if (!reported.ok) throw new Error(reported.error.message);
	const after = reported.value.workspace.saveFile?.pokedex?.species.find((s) => s.id === shinx);
	expect(after?.research).toMatchObject({ level: 70, pending: 70 });
	expect(after?.research?.tasks[defeated]).toMatchObject({ value: 4, reported: 3 });
	const again = await edit(reported.value.bytes, { kind: 'report', species: shinx });
	expect(again.ok && again.value.mutated).toBe(false);

	// Five Number caught goals at 20 points each take the research past 100.
	const caughtTask = tasks.findIndex((t) => t.label === 'Number caught');
	const more = await edit(reported.value.bytes, {
		kind: 'research',
		species: shinx,
		task: caughtTask,
		value: 25
	});
	if (!more.ok) throw new Error(more.error.message);
	const finished = await edit(more.value.bytes, { kind: 'report', species: shinx });
	if (!finished.ok) throw new Error(finished.error.message);
	const complete = finished.value.workspace.saveFile?.pokedex?.species.find((s) => s.id === shinx);
	expect(complete?.research).toMatchObject({ level: 150, complete: true });

	const exported = await engine.serializeSave(finished.value.bytes, file);
	if (!exported.ok) throw new Error(exported.error.message);
	const reread = await engine.loadSaveWorkspace(
		Uint8Array.from(atob(exported.value.bytesBase64), (c) => c.charCodeAt(0)),
		file,
		0
	);
	if (!reread.ok) throw new Error(reread.error.message);
	const species = reread.value.saveFile?.pokedex?.species ?? [];
	expect(species.find((s) => s.id === shinx)).toEqual(complete);
	expect(after?.research?.complete).toBe(false);
	// Other species keep their imported research.
	expect(species.filter((s) => s.id !== shinx)).toEqual(dex?.species.filter((s) => s.id !== shinx));
}, 60_000);

test('Legends: Arceus Seen and Caught marks use the research and obtain flags', async () => {
	const engine = await createPkhexEngine();
	const bytes = new Uint8Array(await (await fetch(fixtureUrl)).arrayBuffer());
	for (const [kind, flag] of [
		['all-seen', 'seen'],
		['all-caught', 'caught']
	] as const) {
		const bulk = await engine.applySaveFileEditOperation(bytes, file, { pokedex: { kind } }, 0);
		if (!bulk.ok) throw new Error(bulk.error.message);
		const marked = bulk.value.workspace.saveFile?.pokedex?.species ?? [];
		expect(marked.filter((s) => s[flag])).toHaveLength(242);
		const again = await engine.applySaveFileEditOperation(
			bulk.value.bytes,
			file,
			{ pokedex: { kind } },
			0
		);
		expect(again.ok && again.value.mutated).toBe(false);
	}
	const pikachu = 25;
	// PKHeX marks a species Seen whenever it writes research progress.
	const researched = await engine.applySaveFileEditOperation(
		bytes,
		file,
		{ pokedex: { kind: 'research', species: pikachu, task: 0, value: 1 } },
		0
	);
	if (!researched.ok) throw new Error(researched.error.message);
	expect(
		researched.value.workspace.saveFile?.pokedex?.species.find((s) => s.id === pikachu)
	).toMatchObject({ seen: true, caught: false });
	const caught = await engine.applySaveFileEditOperation(
		bytes,
		file,
		{ pokedex: { kind: 'caught', species: pikachu, caught: true } },
		0
	);
	if (!caught.ok) throw new Error(caught.error.message);
	expect(
		caught.value.workspace.saveFile?.pokedex?.species.find((s) => s.id === pikachu)
	).toMatchObject({
		seen: true,
		caught: true
	});
	const cleared = await engine.applySaveFileEditOperation(
		caught.value.bytes,
		file,
		{ pokedex: { kind: 'caught', species: pikachu, caught: false } },
		0
	);
	if (!cleared.ok) throw new Error(cleared.error.message);
	expect(
		cleared.value.workspace.saveFile?.pokedex?.species.find((s) => s.id === pikachu)?.caught
	).toBe(false);
}, 60_000);
