export type Summary = { median: number; min: number; max: number };

export function summarize(values: number[]): Summary {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = sorted.length / 2;
	const median =
		sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2;
	return { median, min: sorted[0], max: sorted[sorted.length - 1] };
}

// Run-to-run variation is the wider of the two ranges. A gap within it, or within the probe's resolution, is noise.
export function compare(base: Summary, branch: Summary, resolution = 0) {
	const gap = branch.median - base.median;
	const variation = Math.max(base.max - base.min, branch.max - branch.min);
	return { gap, variation, measurable: Math.abs(gap) > Math.max(variation, resolution) };
}
