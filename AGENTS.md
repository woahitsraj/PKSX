## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, mcp

---

## Unattended pull requests

Scheduled automation may push a branch and open a draft pull request without separate approval only when implementing an issue labeled `ready-for-agent`.

The pull request must:

- address one issue only
- use a meaningful branch name
- include a GitHub closing keyword for the issue
- report failed or incomplete verification in the PR body

This exception does not permit posting issue comments, review comments, creating releases, or sending other external messages without showing the user the complete message and receiving separate approval. Merging is covered separately below.

## Unattended merges

An agent may mark a pull request ready and squash-merge it into `main` without separate approval, but only when all of the following hold:

- the pull request addresses one issue and carries its closing keyword
- the branch is rebased onto the current `main`, with no conflicts beyond mechanical ones
- the full suite passes **on the rebased branch**, not merely on the pull request's last CI run: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit -- --run`, `pnpm test:engine-smoke`, `pnpm test:e2e`, plus `dotnet build` and `dotnet format --verify-no-changes` for engine changes
- every acceptance criterion in the linked issue is traceable to specific code or a specific test in the diff
- the diff stays within the scope of its issue and contradicts no decision recorded in `CONTEXT.md` or `docs/adr/`

Merge one pull request at a time. Branches here are cut from `main` independently, so a green run on one branch is stale as soon as another lands; rebase and re-verify before each merge rather than batching.

Stop and report instead of merging when a rebase conflicts semantically, a check fails, or an acceptance criterion is unmet or cannot be verified. Passing CI is not by itself evidence that a criterion is met.

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues on `woahitsraj/pksx`. See `docs/agents/issue-tracker.md`.

When a PR fully resolves an issue, include a GitHub closing keyword in the PR body, such as `Closes #9`, so the issue closes automatically when the PR merges into `main`.

### Triage labels

The repo uses the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with a root `CONTEXT.md` and ADRs under `docs/adr/`. See `docs/agents/domain.md`.

### Reference projects

PKSX is based on PKHeX and existing web/cross-platform PKHeX projects. Before planning or implementing PKHeX Engine work, read `docs/architecture/reference-projects.md`.
