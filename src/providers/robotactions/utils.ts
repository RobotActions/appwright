import { DeviceOrientation, Platform, RobotActionsConfig } from "../../types";

export const GRID_URL_ENV = "ROBOTACTIONS_GRID_URL";
export const TOKEN_ENV = "ROBOTACTIONS_TOKEN";
export const API_URL_ENV = "ROBOTACTIONS_API_URL";

export type GridEnv = {
  /** Base URL of the grid's WebDriver proxy, no trailing slash. */
  gridUrl: string;
  /** JWT issued by the RobotActions dashboard. */
  token: string;
  /**
   * Base URL used for video download. The grid proxy serves the video routes
   * itself, so this is the grid URL unless `ROBOTACTIONS_API_URL` points
   * somewhere else (e.g. a LAN-only history API on port 3001).
   */
  apiUrl: string;
};

function normalizeUrl(raw: string, envName: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${envName} is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${envName} must be an http(s) URL, got "${raw}"`);
  }
  return url.toString().replace(/\/+$/, "");
}

export function readGridEnv(env = process.env): GridEnv {
  const gridUrl = env[GRID_URL_ENV];
  const token = env[TOKEN_ENV];
  if (!gridUrl || !token) {
    throw new Error(
      `${GRID_URL_ENV} and ${TOKEN_ENV} are required environment variables for the RobotActions device provider. ` +
        `Set ${GRID_URL_ENV} to your grid URL (e.g. https://grid.robotactions.com) and ${TOKEN_ENV} to a token from the dashboard.`,
    );
  }
  const normalizedGridUrl = normalizeUrl(gridUrl, GRID_URL_ENV);
  const apiUrl = env[API_URL_ENV];
  return {
    gridUrl: normalizedGridUrl,
    token,
    apiUrl: apiUrl ? normalizeUrl(apiUrl, API_URL_ENV) : normalizedGridUrl,
  };
}

export type WebDriverTarget = {
  protocol: "http" | "https";
  hostname: string;
  port: number;
  path: string;
};

/**
 * Splits a grid URL into the fields the `webdriver` client expects. The client
 * builds every request as `${protocol}://${hostname}:${port}${path}${endpoint}`,
 * so the URL's path (if any) becomes a prefix for `/session`.
 */
export function toWebDriverTarget(gridUrl: string): WebDriverTarget {
  const url = new URL(gridUrl);
  const protocol = url.protocol === "https:" ? "https" : "http";
  const port = url.port ? Number(url.port) : protocol === "https" ? 443 : 80;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return { protocol, hostname: url.hostname, port, path };
}

/**
 * The build under test, or nothing.
 *
 * A grid session needs no app: with `buildPath` unset the device is handed
 * out as-is (`appium:noReset`) — the smoke a fresh project runs, or a suite
 * that drives a preinstalled app by `appBundleId`. When it is set, the grid
 * fetches it, so it must be somewhere the grid can reach:
 *
 *   - `ra-app://<id>` — a build in the RobotActions App Library, by upload id.
 *     The grid downloads it with this session's token, so nothing is hosted.
 *   - an http(s) URL the grid's devices can download
 *   - an absolute path on the grid host
 *
 * A path on the test runner's disk is not visible to the grid.
 */
export function validateBuildPath(
  buildPath: string | undefined,
): string | undefined {
  if (!buildPath) return undefined;
  if (/^ra-app:\/\/[0-9a-f-]{36}\/?$/i.test(buildPath)) return buildPath;
  if (/^ra-app:\/\//i.test(buildPath)) {
    throw new Error(
      `buildPath "${buildPath}" is not a valid App Library reference — expected ra-app://<upload id> (the id from the Apps page, app_list, or import-url).`,
    );
  }
  if (/^https?:\/\//i.test(buildPath) || buildPath.startsWith("/"))
    return buildPath;
  throw new Error(
    `The RobotActions provider needs buildPath to be an App Library reference (ra-app://<id>), an http(s) URL, or an absolute path on the grid host (got "${buildPath}"). ` +
      `Upload the build to your App Library (dashboard → Apps, or POST /apps/import-url) and use ra-app://<id>.`,
  );
}

export function defaultTestSuite(projectName: string): string {
  return `AppWright ${projectName}`;
}

export type CapabilityInput = {
  platform: Platform;
  device: RobotActionsConfig;
  /** From validateBuildPath: undefined for a device-level session. */
  buildUrl?: string;
  /** Launched (and reset between sessions) when there is no build to install. */
  appBundleId?: string;
  projectName: string;
};

export function buildCapabilities({
  platform,
  device,
  buildUrl,
  appBundleId,
  projectName,
}: CapabilityInput): Record<string, unknown> {
  const isAndroid = platform == Platform.ANDROID;
  const caps: Record<string, unknown> = {
    // The grid keys its tvOS routing on the literal "tvOS" (see its docs);
    // Appium accepts platformName case-insensitively, so the enum values
    // work as-is for the other two.
    platformName: platform == Platform.TVOS ? "tvOS" : platform,
    "appium:automationName": isAndroid ? "uiautomator2" : "xcuitest",
    "appium:autoGrantPermissions": true,
    "appium:autoAcceptAlerts": true,
    "appium:settings[snapshotMaxDepth]": 62,
    "ra:testsuite": device.testSuite ?? defaultTestSuite(projectName),
  };
  if (buildUrl) {
    // A fresh install per session, as the cloud providers do.
    caps["appium:app"] = buildUrl;
    caps["appium:fullReset"] = true;
    if (isAndroid) {
      // Accept whatever activity the app lands on — onboarding/splash flows
      // redirect before the manifest's launcher activity is ever resumed, and
      // UiAutomator2 would otherwise fail with "MainActivity never started".
      caps["appium:appWaitActivity"] = "*";
    }
  } else {
    // Nothing to install: leave the device's state alone. With a bundle id
    // the driver launches that (preinstalled) app; without one the session is
    // device-level and the test picks what to open.
    caps["appium:noReset"] = true;
    if (appBundleId) {
      caps[isAndroid ? "appium:appPackage" : "appium:bundleId"] = appBundleId;
      if (isAndroid) caps["appium:appWaitActivity"] = "*";
    }
  }
  if (device.udid) caps["appium:udid"] = device.udid;
  if (device.deviceClass) caps["appium:deviceClass"] = device.deviceClass;
  if (device.name) caps["appium:deviceName"] = device.name;
  if (device.osVersion) caps["appium:platformVersion"] = device.osVersion;
  if (device.orientation) {
    caps["appium:orientation"] =
      device.orientation == DeviceOrientation.LANDSCAPE
        ? "LANDSCAPE"
        : "PORTRAIT";
  }
  return { ...caps, ...device.capabilities };
}

/**
 * Playwright reports `passed | failed | timedOut | skipped | interrupted`;
 * the grid only records `passed | failed`. Skipped tests are left unmarked.
 */
export function toGridStatus(
  status: string | undefined,
): "passed" | "failed" | undefined {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
    case "timedOut":
    case "interrupted":
      return "failed";
    default:
      return undefined;
  }
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
