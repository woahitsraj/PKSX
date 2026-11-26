import type { EngineApi, SaveSummary } from '$lib/engine';
import { getSaveGameTitle } from '$lib/pksx/saves-library';
import {
	bytesEqual,
	getSaveDisplayName,
	type SavesStorage,
	type StoredSaveFile
} from '$lib/pksx/saves';

type IdentitySummary = Pick<
	SaveSummary,
	'saveType' | 'gameVersionId' | 'rawTrainerId' | 'rawSecretId'
>;

/** A stored Save File that likely is another copy of the file being imported. */
export type SaveImportMatch = {
	saveFile: StoredSaveFile;
	summary: SaveSummary;
	/** The stored imported bytes equal the incoming bytes. */
	exact: boolean;
};

export function saveImportIdentity(summary: IdentitySummary) {
	return [summary.saveType, summary.gameVersionId, summary.rawTrainerId, summary.rawSecretId].join(
		':'
	);
}

/** Checks every stored Save File's imported bytes against the incoming Save File. */
export async function findSaveImportMatches(input: {
	storage: Pick<SavesStorage, 'listSaves' | 'getSaveBytes'>;
	engine: Pick<EngineApi, 'summarizeSave'>;
	bytes: Uint8Array;
	summary: SaveSummary;
}): Promise<SaveImportMatch[]> {
	const identity = saveImportIdentity(input.summary);
	const matches: SaveImportMatch[] = [];
	for (const saveFile of await input.storage.listSaves()) {
		const stored = await input.storage.getSaveBytes(saveFile.id);
		if (!stored) continue;
		if (bytesEqual(stored, input.bytes)) {
			matches.push({ saveFile, summary: input.summary, exact: true });
			continue;
		}
		const summary = await input.engine.summarizeSave(
			stored,
			saveFile.originalFileName ?? undefined
		);
		if (summary.ok && saveImportIdentity(summary.value) === identity)
			matches.push({ saveFile, summary: summary.value, exact: false });
	}
	return matches;
}

/** What the import dialog shows for one match. */
export type SaveImportMatchChoice = {
	id: string;
	name: string;
	fileName: string | null;
	game: string;
	trainer: string;
	exact: boolean;
	dirty: boolean;
	linked: boolean;
};

export function saveImportMatchChoice(
	match: SaveImportMatch,
	dirty: boolean
): SaveImportMatchChoice {
	const { saveFile, summary } = match;
	return {
		id: saveFile.id,
		name: getSaveDisplayName(saveFile),
		fileName: saveFile.originalFileName,
		game: getSaveGameTitle(summary.gameVersion),
		trainer: `${summary.trainerName || 'Unknown Trainer'} · ID ${summary.trainerId}`,
		exact: match.exact,
		dirty,
		linked: Boolean(saveFile.linkedDocumentId)
	};
}
