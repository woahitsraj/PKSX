import { getContext, setContext } from 'svelte';
import {
	closeSummonedWorkflows,
	createSummonedWorkflowOwner,
	dismissSummonedWorkflow,
	openRelatedSummonedWorkflow,
	openSummonedWorkflow,
	type SummonedWorkflow,
	type SummonedWorkflowKind,
	type SummonedWorkflowLauncher,
	type SummonedWorkflowOwner
} from './index';

const hostContextKey = Symbol('pksx-summoned-workflow-host');

export type SummonedWorkflowHost = {
	readonly active: SummonedWorkflow | null;
	open(kind: SummonedWorkflowKind, launcher: SummonedWorkflowLauncher): boolean;
	openRelated(kind: SummonedWorkflowKind, launcher: SummonedWorkflowLauncher): void;
	dismiss(): SummonedWorkflowLauncher | null;
	closeAll(): void;
};

export function createSummonedWorkflowHost(): SummonedWorkflowHost {
	let owner = $state<SummonedWorkflowOwner>(createSummonedWorkflowOwner());

	return {
		get active() {
			return owner.active;
		},
		open(kind, launcher) {
			const next = openSummonedWorkflow(owner, kind, launcher);
			if (next === owner) return false;
			owner = next;
			return true;
		},
		openRelated(kind, launcher) {
			owner = openRelatedSummonedWorkflow(owner, kind, launcher);
		},
		dismiss() {
			const dismissed = dismissSummonedWorkflow(owner);
			owner = dismissed.owner;
			return dismissed.returnLauncher;
		},
		closeAll() {
			owner = closeSummonedWorkflows();
		}
	};
}

export function setSummonedWorkflowHost(host: SummonedWorkflowHost) {
	return setContext(hostContextKey, host);
}

export function getSummonedWorkflowHost() {
	return getContext<SummonedWorkflowHost>(hostContextKey);
}
