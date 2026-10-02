// Imports Save Files into the forwarded profile app through its import control.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { connect } from './cdp.ts';

const cdp = await connect();
try {
	for (const file of process.argv.slice(2)) {
		const message = await cdp.evaluate<string>(`(async () => {
			const input = document.getElementById('save-file-input');
			const bytes = Uint8Array.from(atob(${JSON.stringify(readFileSync(file).toString('base64'))}), (c) => c.charCodeAt(0));
			const files = new DataTransfer();
			files.items.add(new File([bytes], ${JSON.stringify(basename(file))}));
			input.files = files.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
			while (!input.disabled) await new Promise((r) => setTimeout(r, 10));
			while (input.disabled) await new Promise((r) => setTimeout(r, 20));
			return [...document.querySelectorAll('[role=status], [role=alert]')].map((e) => e.innerText.trim()).find((text) => text.includes('import')) ?? '';
		})()`);
		console.log(basename(file), message);
	}
} finally {
	cdp.close();
}
