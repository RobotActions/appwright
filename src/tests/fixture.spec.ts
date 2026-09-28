import { test, expect, vi } from "vitest";

vi.mock("../providers/appium", () => ({
  stopAppiumServer: vi.fn(),
}));

import { reportStatusThenCloseDevice } from "../fixture";
import { stopAppiumServer } from "../providers/appium";
import type { Device } from "../device";
import type { DeviceProvider } from "../types";

function makeCalls() {
  const calls: string[] = [];
  const deviceProvider = {
    syncTestDetails: vi.fn(async () => {
      calls.push("syncTestDetails");
    }),
  } as unknown as DeviceProvider;
  const device = {
    close: vi.fn(async () => {
      calls.push("close");
    }),
  } as unknown as Device;
  return { calls, deviceProvider, device };
}

test("reports status before closing the device", async () => {
  const { calls, deviceProvider, device } = makeCalls();

  await reportStatusThenCloseDevice(
    deviceProvider,
    device,
    { name: "a test", status: "failed", reason: "boom" },
    "robotactions",
  );

  expect(calls).toEqual(["syncTestDetails", "close"]);
  expect(deviceProvider.syncTestDetails).toHaveBeenCalledWith({
    name: "a test",
    status: "failed",
    reason: "boom",
  });
});

test("closes the device even when reporting throws", async () => {
  const { calls, device } = makeCalls();
  const deviceProvider = {
    syncTestDetails: vi.fn(async () => {
      calls.push("syncTestDetails");
      throw new Error("reporting failed");
    }),
  } as unknown as DeviceProvider;

  await expect(
    reportStatusThenCloseDevice(
      deviceProvider,
      device,
      { name: "a test", status: "failed" },
      "robotactions",
    ),
  ).rejects.toThrow("reporting failed");

  expect(calls).toEqual(["syncTestDetails", "close"]);
});

test("stops the local appium server only for emulator/local-device providers", async () => {
  const { deviceProvider, device } = makeCalls();
  vi.mocked(stopAppiumServer).mockClear();

  await reportStatusThenCloseDevice(
    deviceProvider,
    device,
    { name: "a test", status: "passed" },
    "robotactions",
  );
  expect(stopAppiumServer).not.toHaveBeenCalled();

  await reportStatusThenCloseDevice(
    deviceProvider,
    device,
    { name: "a test", status: "passed" },
    "emulator",
  );
  expect(stopAppiumServer).toHaveBeenCalledTimes(1);
});
