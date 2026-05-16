# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.15.3 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:static" drizzle="database:postgresql+postgresql:postgres.js+docker:yes" better-auth="demo:password" paraglide="languageTags:en+demo:yes" mcp="ide:claude-code,cursor,gemini,opencode,vscode+setup:remote" --install pnpm pksx
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
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
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
