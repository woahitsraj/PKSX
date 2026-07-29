#!/usr/bin/env bash

set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${RELEASE_TAG:?RELEASE_TAG is required}"

if ! [[ "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "::error::Release tags must use vX.Y.Z."
	exit 1
fi

tag_object=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$RELEASE_TAG")
if [ "$(jq -r '.object.type' <<<"$tag_object")" != "tag" ]; then
	echo "::error::Release tag must be annotated and signed."
	exit 1
fi

tag_sha=$(jq -r '.object.sha' <<<"$tag_object")
tag_details=$(gh api "repos/$GITHUB_REPOSITORY/git/tags/$tag_sha")
if [ "$(jq -r '.verification.verified' <<<"$tag_details")" != "true" ]; then
	echo "::error::GitHub did not verify the release tag signature."
	exit 1
fi

if [ "$(jq -r '.object.type' <<<"$tag_details")" != "commit" ]; then
	echo "::error::Release tag must point directly to a commit."
	exit 1
fi

release_commit=$(jq -r '.object.sha' <<<"$tag_details")
git fetch origin main
if ! git merge-base --is-ancestor "$release_commit" origin/main; then
	echo "::error::Release tag must point to a commit contained in main."
	exit 1
fi
