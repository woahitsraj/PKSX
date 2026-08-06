# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `woahitsraj/pksx`. Use the `gh` CLI for all operations.

## Conventions

- Create issues with `gh issue create --title "..." --body "..."`
- Read issues with `gh issue view <number> --comments`
- List issues with `gh issue list --state open --json number,title,body,labels,comments`
- Comment with `gh issue comment <number> --body "..."`
- Apply/remove labels with `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- Close with `gh issue close <number> --comment "..."`

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Maps and their tickets are GitHub issues. Maps carry `wayfinder:map`; tickets carry one of `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`.

Child issues and blocking both use GitHub's native APIs, so the frontier renders in the GitHub UI without opening the map. Both APIs take the issue's **database id**, not its number, and both need `-F` (typed) rather than `-f` (string) or they fail with HTTP 422.

```bash
id() { gh api repos/woahitsraj/pksx/issues/"$1" --jq .id; }

# make <ticket> a child of <map>
gh api -X POST repos/woahitsraj/pksx/issues/<map>/sub_issues -F sub_issue_id="$(id <ticket>)"

# make <ticket> blocked by <blocker>
gh api -X POST repos/woahitsraj/pksx/issues/<ticket>/dependencies/blocked_by -F issue_id="$(id <blocker>)"
```

Claim a ticket by assigning it before any work: `gh issue edit <ticket> --add-assignee @me`.

The frontier is the map's open children that are unassigned and have no open blockers:

```bash
gh api repos/woahitsraj/pksx/issues/<map>/sub_issues --jq '.[] | select(.state=="open" and (.assignees|length)==0) | .number' |
  while read -r n; do
    [ "$(gh api repos/woahitsraj/pksx/issues/"$n"/dependencies/blocked_by --jq '[.[]|select(.state=="open")]|length')" = 0 ] &&
      gh issue view "$n" --json number,title --jq '"\(.number)  \(.title)"'
  done
```
