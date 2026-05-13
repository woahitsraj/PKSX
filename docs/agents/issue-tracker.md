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
