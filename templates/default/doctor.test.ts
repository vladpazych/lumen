import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function writeExecutable(path: string, body: string): void {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

describe("doctor.sh", () => {
  test("bootstraps the server directory with uv sync", () => {
    const repoRoot = process.cwd();
    const projectDir = makeTempDir("lumen-doctor-");
    const binDir = join(projectDir, "bin");
    const serverDir = join(projectDir, "server");
    const logFile = join(projectDir, "calls.log");

    mkdirSync(binDir);
    mkdirSync(serverDir, { recursive: true });
    copyFileSync(
      join(repoRoot, "templates/default/doctor.sh"),
      join(projectDir, "doctor.sh"),
    );

    writeExecutable(
      join(binDir, "python3"),
      [
        "#!/usr/bin/env bash",
        'if [[ "$1" == "-c" && "$2" == *"version_info.major"* ]]; then',
        '  echo "3.12"',
        "fi",
        "exit 0",
        "",
      ].join("\n"),
    );
    writeExecutable(
      join(binDir, "modal"),
      "#!/usr/bin/env bash\nexit 0\n",
    );
    writeExecutable(
      join(binDir, "code"),
      "#!/usr/bin/env bash\nexit 0\n",
    );
    writeExecutable(
      join(binDir, "uv"),
      [
        "#!/usr/bin/env bash",
        'if [[ "$1" == "--version" ]]; then',
        '  echo "uv 9.9.9"',
        "  exit 0",
        "fi",
        `echo "PWD=$PWD ARGS=$*" >> "${logFile.replaceAll('"', '\\"')}"`,
        "exit 0",
        "",
      ].join("\n"),
    );

    const result = spawnSync("/bin/bash", [join(projectDir, "doctor.sh")], {
      cwd: projectDir,
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
      encoding: "utf-8",
    });

    if (result.status !== 0) {
      throw new Error(
        `doctor.sh exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }
    expect(result.stdout).toContain("Bootstrapping server...");
    expect(result.stdout).toContain("Ready.");

    const calls = readFileSync(logFile, "utf-8");
    expect(calls).toContain(`PWD=${serverDir} ARGS=sync`);
    expect(calls).not.toContain("lumen-sdk");
  });
});
