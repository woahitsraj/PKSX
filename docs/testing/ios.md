# iOS testing

The iOS acceptance suite launches the Capacitor app in an iPhone simulator and sends
real synthetic `GCController` inputs through the native app. It verifies WebView focus,
visible controller highlights, menu controls, shortcuts, and the mobile layout.

## One-time setup

Install the full Xcode app, select it as the active developer directory, and accept its
license. Then install an iOS simulator runtime:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -downloadPlatform iOS
```

Confirm that at least one iPhone simulator is available:

```sh
xcrun simctl list devices available
```

## Run the tests

Install dependencies, sync the current web build into the native project, and run the
three simulator acceptance tests:

```sh
pnpm install
pnpm test:ios
```

Set `PKSX_IOS_SIMULATOR` to a simulator UDID if you do not want to use the first
available iPhone:

```sh
PKSX_IOS_SIMULATOR=YOUR-SIMULATOR-UDID pnpm test:ios
```

The runner boots and shuts down a simulator when needed. CI runs the same script on
the `macos-26` runner after syncing the downloaded web build.
