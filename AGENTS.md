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

This exception does not permit posting issue comments, review comments, merging pull requests, creating releases, or sending other external messages without showing the user the complete message and receiving separate approval.

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
