# PKSX

PKSX is an offline-first Pokemon save management app with a controller-friendly SvelteKit UI and a PKHeX.Core-backed WebAssembly engine.

## Developing

Install dependencies with `pnpm install`, then start a development server:

```sh
pnpm dev

# or start the server and open the app in a new browser tab
pnpm dev -- --open
```

## Building

To publish the local PKHeX Engine and sync its browser WebAssembly assets into SvelteKit's static asset tree:

```sh
pnpm engine:sync
```

The command publishes `engine/Pksx.Pkhex.Engine` in `Release` configuration, removes any existing `static/pkhex-engine`, and copies the published `AppBundle` there. The synced assets are generated output and are ignored by git.

To publish a different configuration:

```sh
pnpm engine:sync -- --configuration Debug
```

To test against a local PKHeX source checkout instead of the pinned `PKHeX.Core` NuGet package:

```sh
pnpm engine:sync -- --property UseLocalPKHeX=true --property PKHeXSourcePath=/path/to/PKHeX/PKHeX.Core/PKHeX.Core.csproj
```

The command uses Node's native TypeScript execution, so it requires Node.js 23.6 or newer. It also requires the .NET SDK and the browser WebAssembly workload:

```sh
dotnet workload install wasm-tools
```

To create a production version of your app:

```sh
pnpm build
```

You can preview the production build with `pnpm preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
