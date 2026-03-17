import { spawnSync } from "node:child_process";

export type ModalMachineAuth = {
  cliInstalled: boolean;
  authenticated: boolean;
};

type SpawnSyncLike = typeof spawnSync;

const MODAL_SETTINGS_URL = "https://modal.com/settings/";

export function modalSettingsUrl(): string {
  return MODAL_SETTINGS_URL;
}

export function describeModalMachineAuth(
  run: SpawnSyncLike = spawnSync,
): ModalMachineAuth {
  const cliCheck = run(
    "/bin/sh",
    ["-lc", "command -v modal >/dev/null 2>&1"],
    { encoding: "utf-8" },
  );
  if (cliCheck.status !== 0) {
    return { cliInstalled: false, authenticated: false };
  }

  const authCheck = run("modal", ["token", "info"], {
    encoding: "utf-8",
  });
  return {
    cliInstalled: true,
    authenticated: authCheck.status === 0,
  };
}

export function assertModalMachineAuth(
  run: SpawnSyncLike = spawnSync,
): void {
  const status = describeModalMachineAuth(run);
  if (!status.cliInstalled) {
    throw new Error(
      `Install the Modal CLI, then open ${MODAL_SETTINGS_URL} and run modal token set on this machine.`,
    );
  }
  if (!status.authenticated) {
    throw new Error(
      `Set up Modal auth on this machine. Open ${MODAL_SETTINGS_URL} and run modal token set.`,
    );
  }
}
