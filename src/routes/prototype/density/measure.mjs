// Throwaway: measures each variant on every canvas. Run the dev server first, then `pnpm prototype:density:measure`.
import { chromium } from 'playwright';

const base = process.env.PROTOTYPE_URL ?? 'http://localhost:5174/prototype/density';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });

for (const variant of ['A', 'B', 'C']) {
	await page.goto(`${base}?variant=${variant}&controls=0`);
	await page.waitForSelector(`.variant-${variant}`);
	await page.waitForTimeout(300);
	const rows = await page.evaluate(() => {
		const px = (v) => Math.round(parseFloat(v) * 10) / 10;
		const out = [];
		for (const row of document.querySelectorAll('.row')) {
			const screen = row.querySelector('h2').textContent.split(' ')[0];
			for (const frame of row.querySelectorAll('[data-canvas]')) {
				const root = frame.querySelector('.density-root');
				const cs = getComputedStyle(root);
				const tokens = [
					'--t-caption',
					'--t-label',
					'--t-body',
					'--t-title',
					'--t-display',
					'--t-control',
					'--t-unit'
				].map((t) => px(cs.getPropertyValue(t)));
				const slot = frame.querySelector('.slot');
				const sprite = frame.querySelector('.slot .sprite');
				const ctrl = frame.querySelector('input.ctrl, button.ctrl');
				const fb = frame.getBoundingClientRect();
				const scale = fb.width / frame.offsetWidth;
				let minFont = Infinity;
				let clipped = 0;
				for (const el of frame.querySelectorAll('*')) {
					const s = getComputedStyle(el);
					if (s.display === 'none' || el.closest('[data-scroll]')) continue;
					if (
						el.childNodes.length &&
						[...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
					)
						minFont = Math.min(minFont, parseFloat(s.fontSize));
					const b = el.getBoundingClientRect();
					if (b.width && (b.bottom > fb.bottom + 1 || b.right > fb.right + 1)) clipped += 1;
				}
				const scrolls = [...frame.querySelectorAll('[data-scroll]')].filter(
					(el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
				).length;
				out.push({
					screen,
					canvas: frame.dataset.canvas,
					tokens,
					slot: slot ? Math.round(slot.getBoundingClientRect().width / scale) : null,
					sprite: sprite ? Math.round(sprite.getBoundingClientRect().height / scale) : null,
					control: ctrl ? Math.round(ctrl.getBoundingClientRect().height / scale) : null,
					minFont: Math.round(minFont * 10) / 10,
					scrolls,
					clipped
				});
			}
		}
		return out;
	});
	console.log(`\n## Variant ${variant}\n`);
	console.log(
		'| Screen | Canvas | caption/label/body/title/display | control | unit | Slot | sprite | min text | scrolling panes | clipped |'
	);
	console.log('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
	for (const r of rows) {
		const [c, l, b, t, d, ctl, u] = r.tokens;
		console.log(
			`| ${r.screen} | ${r.canvas} | ${c}/${l}/${b}/${t}/${d} | ${r.control ?? ctl} | ${u} | ${r.slot ?? ''} | ${r.sprite ?? ''} | ${r.minFont} | ${r.scrolls} | ${r.clipped} |`
		);
	}
}
await browser.close();
