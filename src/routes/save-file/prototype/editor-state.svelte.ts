// Throwaway in-memory commit model for #169. Mirrors the #209 boundaries; never touches the Workspace.
import { SvelteSet } from 'svelte/reactivity';
import type { InventoryItemOption, SaveFileEditableProjection, TrainerGender } from '$lib/engine';
import { formatMoney } from './prototype-data';

export type Toast = { id: string; tone: 'info' | 'success' | 'error'; message: string };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PrototypeEditor {
	projection = $state() as SaveFileEditableProjection;
	pending = new SvelteSet<string>();
	toasts = $state<Toast[]>([]);
	failNext = $state(false);
	lastEvent = $state('No commits yet');

	constructor(projection: SaveFileEditableProjection) {
		this.projection = projection;
	}

	get profile() {
		return this.projection.trainerProfile;
	}

	get money() {
		return this.projection.money;
	}

	get pockets() {
		return this.projection.inventory.pockets;
	}

	pocket(key: string) {
		return this.pockets.find((pocket) => pocket.key === key);
	}

	validateName(name: string) {
		const max = this.profile.trainerNameMaxLength;
		const value = name.trim();
		if (value.length === 0 || value.length > max)
			return `Trainer name must be 1 to ${max} characters.`;
		return null;
	}

	validateMoney(raw: string) {
		const value = Number(raw.replaceAll(',', ''));
		const { min, max } = this.money;
		if (!Number.isInteger(value) || value < min || value > max)
			return `Money must be between ${formatMoney(min)} and ${formatMoney(max)}.`;
		return null;
	}

	validateQuantity(quantity: number, max: number) {
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > max)
			return `Quantity must be 1 to ${max}.`;
		return null;
	}

	async commitTrainerName(name: string) {
		const value = name.trim();
		if (value === this.profile.trainerName) return true;
		return this.commit('trainer-name', 'Trainer name', (p) => {
			p.trainerProfile.trainerName = value;
		});
	}

	async commitGender(gender: TrainerGender) {
		if (gender === this.profile.gender) return true;
		return this.commit('trainer-gender', 'Trainer gender', (p) => {
			p.trainerProfile.gender = gender;
		});
	}

	async commitMoney(value: number) {
		if (value === this.money.value) return true;
		return this.commit('money', 'Money', (p) => {
			p.money.value = value;
		});
	}

	async setQuantity(pocket: string, itemId: number, quantity: number) {
		const item = this.pocket(pocket)?.items.find((candidate) => candidate.id === itemId);
		if (!item || quantity === item.quantity) return true;
		return this.commit(`qty:${pocket}:${itemId}`, item.name, (p) => {
			const target = p.inventory.pockets
				.find((candidate) => candidate.key === pocket)
				?.items.find((candidate) => candidate.id === itemId);
			if (target) target.quantity = quantity;
		});
	}

	async addItem(pocket: string, option: InventoryItemOption, quantity: number) {
		return this.commit(`add:${pocket}`, option.name, (p) => {
			const target = p.inventory.pockets.find((candidate) => candidate.key === pocket);
			if (!target) return;
			target.items.push({ ...option, quantity });
			target.full = target.items.length >= target.capacity;
		});
	}

	async removeItem(pocket: string, itemId: number) {
		const item = this.pocket(pocket)?.items.find((candidate) => candidate.id === itemId);
		if (!item) return true;
		return this.commit(`remove:${pocket}:${itemId}`, item.name, (p) => {
			const target = p.inventory.pockets.find((candidate) => candidate.key === pocket);
			if (!target) return;
			target.items = target.items.filter((candidate) => candidate.id !== itemId);
			target.full = false;
		});
	}

	dismissToast(id: string) {
		this.toasts = this.toasts.filter((toast) => toast.id !== id);
	}

	private async commit(
		key: string,
		label: string,
		mutate: (projection: SaveFileEditableProjection) => void
	) {
		this.pending.add(key);
		await delay(650);
		this.pending.delete(key);
		if (this.failNext) {
			this.failNext = false;
			this.toast(`Could not save ${label}. The previous value was restored.`);
			this.lastEvent = `Failed: ${label}`;
			return false;
		}
		const next = structuredClone($state.snapshot(this.projection)) as SaveFileEditableProjection;
		mutate(next);
		this.projection = next;
		this.lastEvent = `Committed: ${label}`;
		return true;
	}

	private toast(message: string) {
		const id = crypto.randomUUID();
		this.toasts = [...this.toasts, { id, tone: 'error', message }];
		setTimeout(() => this.dismissToast(id), 6000);
	}
}
