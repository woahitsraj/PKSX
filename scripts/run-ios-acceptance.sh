#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device_id="${PKSX_IOS_SIMULATOR:-}"
started_simulator=false
derived_data="$(mktemp -d "${TMPDIR:-/tmp}/pksx-ios.XXXXXX")"

cleanup() {
	if $started_simulator; then
		xcrun simctl shutdown "$device_id" >/dev/null 2>&1 || true
	fi
	rm -rf "$derived_data"
}
trap cleanup EXIT

if [[ -z "$device_id" ]]; then
	device_id="$(xcrun simctl list devices available | awk -F '[()]' '/iPhone/ { print $2; exit }')"
fi

if [[ -z "$device_id" ]]; then
	echo "No iPhone simulator is available. Follow docs/testing/ios.md to install one." >&2
	exit 1
fi

device_state="$(xcrun simctl list devices | awk -v id="$device_id" '$0 ~ id { print $NF }' | tr -d '()')"
if [[ "$device_state" != "Booted" ]]; then
	xcrun simctl boot "$device_id"
	xcrun simctl bootstatus "$device_id" -b
	started_simulator=true
fi

xcodebuild test \
	-project "$project_root/ios/App/App.xcodeproj" \
	-scheme App \
	-destination "platform=iOS Simulator,id=$device_id" \
	-derivedDataPath "$derived_data" \
	CODE_SIGNING_ALLOWED=NO
