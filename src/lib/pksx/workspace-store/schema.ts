import type { TablesSchema, ValuesSchema } from 'tinybase';

export const WORKSPACE_SCHEMA_VERSION = 1;
export const WORKSPACE_PARSER_VERSION = 'pkhex-engine-v1';

export const workspaceTablesSchema = {
	workspaces: {
		saveFileId: { type: 'string' },
		activeBox: { type: 'number' },
		summary: { type: 'string' },
		saveFile: { type: 'string' },
		restoredFromBackup: { type: 'string' },
		automaticBackupCreated: { type: 'boolean' }
	},
	boxes: {
		saveFileId: { type: 'string' },
		index: { type: 'number' }
	},
	slots: {
		saveFileId: { type: 'string' },
		zone: { type: 'string' },
		box: { type: 'number' },
		slot: { type: 'number' },
		projection: { type: 'string' }
	},
	validation: {
		saveFileId: { type: 'string' },
		status: { type: 'string' },
		output: { type: 'string' }
	}
} satisfies TablesSchema;

export const workspaceValuesSchema = {
	schemaVersion: { type: 'number', default: WORKSPACE_SCHEMA_VERSION },
	parserVersion: { type: 'string', default: WORKSPACE_PARSER_VERSION },
	activeSaveFileId: { type: 'string', default: '' },
	dirty: { type: 'boolean', default: false },
	editorState: { type: 'string', default: 'idle' },
	validationState: { type: 'string', default: 'idle' }
} satisfies ValuesSchema;
