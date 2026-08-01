# Android testing

PKSX uses an API 36 emulator for native controller acceptance tests. The test sends
controller-sourced Android key and joystick events into `MainActivity`, then verifies
Controller Focus and visible WebView state.

## One-time setup on Apple silicon

Android Studio and JDK 21 must be installed. Accept the Android SDK licenses yourself:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" --licenses
```

Install the API 36 platform and ARM emulator image:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" \
  "platforms;android-36" \
  "system-images;android-36;google_apis;arm64-v8a"
```

Create the test AVD:

```sh
echo no | "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager" \
  create avd \
  --force \
  --name pksx-api-36 \
  --package "system-images;android-36;google_apis;arm64-v8a" \
  --device pixel_2
```

Set JDK 21 for the current shell:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

## Run

Build a debug APK:

```sh
pnpm android:build
```

Run the controller and small-widescreen acceptance tests:

```sh
pnpm test:android
```

The test command starts `pksx-api-36` headlessly when no emulator is running, configures
it to 960 by 540, runs the instrumentation suite, and shuts it down. CI runs the same
instrumentation suite on an API 36 x86_64 emulator.
