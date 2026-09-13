<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<section id="about-pksx" class="introduction" aria-labelledby="about-pksx-title">
	<h2 id="about-pksx-title">Pokémon save management, built for mobile and controllers</h2>
	<p>
		PKSX is a free, open-source Pokémon save editor and manager with a cross-platform,
		controller-first design. Your saves stay on your device.
	</p>
	<details open={!compact}>
		<summary>About PKSX</summary>
		<div class="about-copy">
			<section aria-labelledby="getting-started-title">
				<h3 id="getting-started-title">Start with your save</h3>
				<p>
					Import a Pokémon save file using the selector above, then open it to browse your boxes,
					organize Pokémon and edit your save. Export the result when you are ready to use it in
					your game. Keep a copy of your original save.
				</p>
				<p>
					Import a save file, not a game ROM. PKSX checks whether it can read the file before adding
					it to Saves. Supported operations vary by game and save format.
				</p>
			</section>
			<section aria-labelledby="play-your-way-title">
				<h3 id="play-your-way-title">At home on a handheld</h3>
				<p>
					Navigate with a controller, touch, keyboard or mouse. PKSX is built for mobile screens and
					handhelds, with native Android and iOS apps and desktop releases planned.
				</p>
				<p>
					You can use the web app now, or install it from your browser where supported. Saves are
					stored locally on this device, without an account or cloud upload. Export backups before
					clearing browser data or switching devices.
				</p>
			</section>
			<section aria-labelledby="pkhex-title">
				<h3 id="pkhex-title">Powered by PKHeX</h3>
				<p>
					PKSX uses <a href="https://github.com/kwsch/PKHeX">PKHeX.Core</a> for save parsing, editing
					and legality checks. It is a separate application with its own interface and supported workflows,
					not a complete replacement for every PKHeX feature.
				</p>
			</section>
		</div>
	</details>

	<section id="app-downloads" class="downloads" aria-labelledby="downloads-title">
		<h3 id="downloads-title">PKSX on your devices</h3>
		<p>
			Use PKSX here today. Native app downloads will appear here when public releases are ready.
		</p>
		<dl>
			<div>
				<dt>Android</dt>
				<dd>Planned</dd>
			</div>
			<div>
				<dt>iPhone &amp; iPad</dt>
				<dd>Planned</dd>
			</div>
			<div>
				<dt>Desktop <span>Windows, macOS &amp; Linux</span></dt>
				<dd>Planned</dd>
			</div>
		</dl>
	</section>
	<footer>
		<a href="https://github.com/woahitsraj/pksx">Source code &amp; releases</a>
		<a href="https://github.com/woahitsraj/pksx/issues">Report an issue</a>
	</footer>
</section>

<style>
	.introduction {
		margin-top: calc(var(--pksx-space-unit) * 6);
		padding: var(--pksx-space-4) 0 var(--pksx-space-3);
		border-top: 1px solid var(--rule);
		color: var(--ink-soft);
		font-size: var(--pksx-type-body);
		line-height: 1.65;
	}
	h2,
	h3,
	dt {
		color: var(--ink);
	}
	h2 {
		max-width: 32ch;
		margin: 0 0 var(--pksx-space-3);
		font-size: var(--pksx-type-display);
		font-weight: 650;
		line-height: 1.2;
		text-wrap: balance;
	}
	h3 {
		margin: 0 0 var(--pksx-space-2);
		font-size: var(--pksx-type-title);
		font-weight: 650;
	}
	p {
		max-width: 70ch;
		margin: 0 0 var(--pksx-space-3);
	}
	summary {
		width: fit-content;
		padding: var(--pksx-space-2) 0;
		color: var(--rust);
		font-weight: 650;
		cursor: pointer;
	}
	.about-copy {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		gap: var(--pksx-space-4);
		padding: var(--pksx-space-3) 0;
	}
	.downloads {
		margin-top: var(--pksx-space-4);
	}
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pksx-space-4) calc(var(--pksx-space-unit) * 8);
		margin: var(--pksx-space-4) 0;
	}
	dt {
		font-weight: 650;
	}
	dt span {
		display: block;
		color: var(--ink-soft);
		font-size: var(--pksx-type-label);
		font-weight: 400;
	}
	dd {
		margin: var(--pksx-space-1) 0 0;
		font-size: var(--pksx-type-label);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pksx-space-2) var(--pksx-space-4);
		margin-top: var(--pksx-space-4);
	}
	a {
		color: var(--rust);
		text-underline-offset: 3px;
	}
	a:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--rust-ring);
		outline-offset: 4px;
	}
</style>
