import { type FullConfig } from "@playwright/test";
import { AppwrightConfig } from "./types";
import { createDeviceProvider } from "./providers";

async function globalSetup(config: FullConfig<AppwrightConfig>) {
  const args = process.argv;
  const projects: string[] = [];
  args.forEach((arg, index) => {
    if (arg === "--project") {
      const project = args[index + 1];
      if (project) {
        projects.push(project);
      } else {
        throw new Error("Project name is required with --project flag");
      }
    }
  });

  // No --project: set up every project. The original restriction guarded the
  // local providers, which all spawn one Appium on one port; a remote provider
  // has nothing to collide, and `npx playwright test` with no project filter
  // is the normal way to run a multi-platform suite.
  const selected = projects.length
    ? config.projects.filter((p) => projects.includes(p.name))
    : config.projects;
  const localProviders = new Set(["emulator", "local-device"]);
  if (
    projects.length == 0 &&
    selected.filter((p) => localProviders.has(String(p.use.device?.provider)))
      .length > 1
  ) {
    throw new Error(
      "Running several emulator/local-device projects at once is not supported. Please specify the project name with --project flag.",
    );
  }

  for (let i = 0; i < config.projects.length; i++) {
    if (selected.includes(config.projects[i]!)) {
      const provider = createDeviceProvider(config.projects[i]!);
      await provider.globalSetup?.();
    }
  }
}

export default globalSetup;
