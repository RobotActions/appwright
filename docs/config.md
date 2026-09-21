# Configuration

Appwright provides a set of configuration options that you can use to customize 
the test environment and thus the behavior of the tests.

## Device Providers

Device providers make Appium compatible mobile devices available to Appwright. These
providers are supported:

- `local-device`
- `emulator`
- `browserstack`
- `lambdatest`
- `robotactions`

### BrowserStack

BrowserStack [App Automate](https://www.browserstack.com/app-automate) can be used to provide
remote devices to Appwright.

These environment variables are required for the BrowserStack

- BROWSERSTACK_USERNAME
- BROWSERSTACK_ACCESS_KEY

BrowserStack also requires `name` and `osVersion` of the device to be set in the projects in appwright config file.

### LambdaTest

LambdaTest [Real Device Cloud](https://www.lambdatest.com/support/docs/app-testing-on-real-devices/) can be used to provide
remote devices to Appwright.

These environment variables are required for the LambdaTest

- LAMBDATEST_USERNAME
- LAMBDATEST_ACCESS_KEY

LambdaTest also requires `name` and `osVersion` of the device to be set in the projects in appwright config file.

### RobotActions

A [RobotActions](https://robotactions.com) grid can be used to provide remote real devices
to Appwright.

These environment variables are required for RobotActions

- ROBOTACTIONS_GRID_URL — the grid URL, e.g. `https://grid.robotactions.com`
- ROBOTACTIONS_TOKEN — an access token from the RobotActions dashboard

Session videos are downloaded from the grid and attached to the Playwright report. Set
`ROBOTACTIONS_API_URL` only if recordings should be fetched from a different host than the
grid URL (e.g. the grid's LAN-only history API on port 3001).

Everything else is optional. `buildPath`, when set, is one of: `ra-app://<id>` — a build in your
RobotActions App Library (dashboard → Apps, `POST /apps/import-url`, or the `app_upload` MCP
tool), fetched by the grid with this session's token so nothing needs hosting; an `http(s)://`
URL the grid's devices can download; or an absolute path on the grid host. Without it the
session is device-level: nothing installed, and with `appBundleId` set the driver launches that
preinstalled app. `udid`, `osVersion`, `deviceClass` (`"TV"` for an Android TV / Chromecast,
`"iPad"`, `"Phone"`…), `orientation`, `testSuite` and `capabilities` (extra Appium capabilities,
including the grid's `ra:*` reporting caps) narrow the request.

Apple TV: `platform: Platform.TVOS`. Same XCUITest driver as iOS, but there is no touch
surface — navigate focus with `getByText(...).tap()` (focuses then selects) or the remote via
`deviceProvider.client.executeScript("mobile: pressButton", [{ name: "down" }])`.

A run with no `--project` sets up every project (the original restriction only protected the
local providers, which share one Appium port).

### Android Emulator

To run tests on the Android emulator, ensure the following installations are available. If not, follow these steps:

1. **Install Android Studio**: If not installed, download and install it from [here](https://developer.android.com/studio).
2. **Set Android SDK location**: Open Android Studio, copy the Android SDK location, and set the `ANDROID_HOME` environment variable to the same path.
3. **Check Java Installation**: Verify if Java is installed by running `java -version`. If it's not installed:
   - Install Java using Homebrew: `brew install java`.
   - After installation, run the symlink command provided at the end of the installation process.


To check for available emulators, run the following command:

```sh
$ANDROID_HOME/emulator/emulator --list-avds
```

### iOS Simulator

To run tests on the iOS Simulator, ensure the following installations are available. If not, follow these steps:

1. **Install Xcode**: If not installed, download and install it from [here](https://developer.apple.com/xcode/).
2. **Download iOS Simulator**: While installing Xcode, you will be prompted to select the platform to develop for. Ensure that iOS is selected.

To check for available iOS simulators, run the following command:

```sh
xcrun simctl list
```
