import { test as base, FullProject } from "@playwright/test";

import {
  AppwrightLocator,
  DeviceProvider,
  ActionOptions,
  AppwrightConfig,
} from "../types";
import { Device } from "../device";
import { createDeviceProvider } from "../providers";
import { WorkerInfoStore } from "./workerInfo";
import { stopAppiumServer } from "../providers/appium";

type TestLevelFixtures = {
  /**
   * Device provider to be used for the test.
   * This creates and manages the device lifecycle for the test
   */
  deviceProvider: DeviceProvider;

  /**
   * The device instance that will be used for running the test.
   * This provides the functionality to interact with the device
   * during the test.
   */
  device: Device;
};

type WorkerLevelFixtures = {
  persistentDevice: Device;
};

/**
 * Reports the final test status to the provider, then closes the device.
 *
 * Order matters: a grid provider (e.g. RobotActions) captures its failure
 * snapshot (page source, screenshot) when it receives a failed status, and
 * can only do that while the session is still alive. Reporting after
 * `device.close()` means the session is already gone by the time the grid
 * sees the failure, so the snapshot is always null.
 *
 * `device.close()` stays in `finally` so an error while reporting (e.g.
 * browserstack's `syncTestDetails` throws on a non-OK response) can never
 * leak the device or a stray local Appium server.
 */
export async function reportStatusThenCloseDevice(
  deviceProvider: DeviceProvider,
  device: Device,
  details: { name: string; status?: string; reason?: string },
  deviceProviderName: string | undefined,
): Promise<void> {
  try {
    await deviceProvider.syncTestDetails?.(details);
  } finally {
    await device.close();
    if (
      deviceProviderName === "emulator" ||
      deviceProviderName === "local-device"
    ) {
      await stopAppiumServer();
    }
  }
}

export const test = base.extend<TestLevelFixtures, WorkerLevelFixtures>({
  deviceProvider: async ({}, use, testInfo) => {
    const deviceProvider = createDeviceProvider(testInfo.project);
    await use(deviceProvider);
  },
  device: async ({ deviceProvider }, use, testInfo) => {
    const device = await deviceProvider.getDevice();
    const deviceProviderName = (
      testInfo.project as FullProject<AppwrightConfig>
    ).use.device?.provider;
    testInfo.annotations.push({
      type: "providerName",
      description: deviceProviderName,
    });
    testInfo.annotations.push({
      type: "sessionId",
      description: deviceProvider.sessionId,
    });
    await deviceProvider.syncTestDetails?.({
      name: testInfo.title,
      testId: testInfo.testId,
    });
    await use(device);
    await reportStatusThenCloseDevice(
      deviceProvider,
      device,
      {
        name: testInfo.title,
        status: testInfo.status,
        reason: testInfo.error?.message,
      },
      deviceProviderName,
    );
  },
  persistentDevice: [
    async ({}, use, workerInfo) => {
      const { project, workerIndex } = workerInfo;
      const beforeSession = new Date();
      const deviceProvider = createDeviceProvider(project);
      const device = await deviceProvider.getDevice();
      const sessionId = deviceProvider.sessionId;
      if (!sessionId) {
        throw new Error("Worker must have a sessionId.");
      }
      const providerName = (project as FullProject<AppwrightConfig>).use.device
        ?.provider;
      const afterSession = new Date();
      const workerInfoStore = new WorkerInfoStore();
      await workerInfoStore.saveWorkerStartTime(
        workerIndex,
        sessionId,
        providerName!,
        beforeSession,
        afterSession,
      );
      await use(device);
      await workerInfoStore.saveWorkerEndTime(workerIndex, new Date());
      await device.close();
    },
    { scope: "worker" },
  ],
});

/**
 * Function to extend Playwright’s expect assertion capabilities.
 * This adds a new method `toBeVisible` which checks if an element is visible on the screen.
 *
 * @param locator The AppwrightLocator that locates the element on the device screen.
 * @param options
 * @returns
 */
export const expect = test.expect.extend({
  toBeVisible: async (locator: AppwrightLocator, options?: ActionOptions) => {
    const isVisible = await locator.isVisible(options);
    return {
      message: () => (isVisible ? "" : `Element was not found on the screen`),
      pass: isVisible,
      name: "toBeVisible",
      expected: true,
      actual: isVisible,
    };
  },
});
