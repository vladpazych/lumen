import { describe, expect, test } from "bun:test";
import {
  assertModalMachineAuth,
  describeModalMachineAuth,
  modalSettingsUrl,
} from "../src/modal-auth";

describe("modal-auth", () => {
  test("reports when the Modal CLI is missing", () => {
    const status = describeModalMachineAuth(() => ({ status: 1 }) as never);
    expect(status).toEqual({
      cliInstalled: false,
      authenticated: false,
    });
  });

  test("reports when the Modal CLI is installed and authenticated", () => {
    let calls = 0;
    const status = describeModalMachineAuth(() => {
      calls += 1;
      return { status: 0 } as never;
    });
    expect(calls).toBe(2);
    expect(status).toEqual({
      cliInstalled: true,
      authenticated: true,
    });
  });

  test("guides the user to Modal settings when auth is missing", () => {
    expect(() =>
      assertModalMachineAuth((command) =>
        ({ status: command === "/bin/sh" ? 0 : 1 }) as never,
      ),
    ).toThrow(`Open ${modalSettingsUrl()} and run modal token set.`);
  });
});
