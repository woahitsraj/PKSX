#!/usr/bin/env bash
set -euo pipefail

sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
adb_bin="$sdk_root/platform-tools/adb"
emulator_bin="$sdk_root/emulator/emulator"
avd_name="${PKSX_ANDROID_AVD:-pksx-api-36}"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname)" == "Darwin" ]]; then
	export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
fi

serial="$("$adb_bin" devices | awk '$1 ~ /^emulator-/ { print $1; exit }')"
if [[ -z "$serial" ]]; then
	if ! "$emulator_bin" -list-avds | grep -Fxq "$avd_name"; then
		echo "Missing AVD '$avd_name'. Follow docs/testing/android.md to create it." >&2
		exit 1
	fi

	"$emulator_bin" "@$avd_name" -no-snapshot -noaudio -gpu swiftshader_indirect \
		>/tmp/pksx-android-emulator.log 2>&1 &
fi

cd "$project_root"
pnpm android:build

for _ in {1..180}; do
	serial="$("$adb_bin" devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')"
	if [[ -n "$serial" ]] && [[ "$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
		break
	fi
	sleep 1
done

if [[ -z "$serial" ]] || [[ "$("$adb_bin" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; then
	echo "Android emulator did not boot. See /tmp/pksx-android-emulator.log." >&2
	exit 1
fi

"$adb_bin" -s "$serial" install -r android/app/build/outputs/apk/debug/app-debug.apk
"$adb_bin" -s "$serial" shell am start -n com.pksx.app/.MainActivity
