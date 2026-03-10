/**
 * release — bump version, commit, and tag.
 */

import { DexterError, command } from "@vladpazych/dexter/cli"
import type { CLIContext } from "@vladpazych/dexter/cli"
import { z } from "zod"

const VALID_BUMPS = ["patch", "minor", "major"] as const
const PACKAGES = {
  lumen: {
    dir: "packages/lumen",
    tagPrefix: "v",
  },
  vscode: {
    dir: "packages/vscode",
    tagPrefix: "vscode-v",
  },
} as const

type PackageName = keyof typeof PACKAGES

type ReleaseResult = {
  currentVersion: string
  nextVersion: string
  tag: string
}

function ensureSuccess(result: ReturnType<typeof Bun.spawnSync>, step: string): void {
  if (result.exitCode === 0) return

  const stderr = result.stderr?.toString().trim() ?? ""
  const message = stderr.length > 0 ? `${step} failed: ${stderr}` : `${step} failed`
  throw new DexterError("release-command-failed", message)
}

export const release = command({
  description: "Bump a package version, create a commit, and tag the release.",
  args: [
    {
      name: "package",
      description: "Package to release.",
      schema: z.enum(Object.keys(PACKAGES) as [PackageName, ...PackageName[]]),
    },
    {
      name: "bump",
      description: "Version increment to apply.",
      schema: z.enum(VALID_BUMPS),
    },
  ] as const,
  async run(
    input: { args: { package: PackageName; bump: (typeof VALID_BUMPS)[number] } },
    ctx: CLIContext,
  ): Promise<ReleaseResult> {
    const pkg = PACKAGES[input.args.package]
    const pkgPath = `${ctx.root}/${pkg.dir}/package.json`
    const pkgJson = JSON.parse(await Bun.file(pkgPath).text()) as { version: string }
    const currentVersion = pkgJson.version
    const [major, minor, patch] = currentVersion.split(".").map(Number)

    if (major === undefined || minor === undefined || patch === undefined) {
      throw new DexterError("invalid-version", `Invalid version in ${pkgPath}: ${currentVersion}`)
    }

    let nextVersion = currentVersion
    switch (input.args.bump) {
      case "major":
        nextVersion = `${major + 1}.0.0`
        break
      case "minor":
        nextVersion = `${major}.${minor + 1}.0`
        break
      case "patch":
        nextVersion = `${major}.${minor}.${patch + 1}`
        break
    }

    pkgJson.version = nextVersion
    await Bun.write(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n")

    const tag = `${pkg.tagPrefix}${nextVersion}`
    ensureSuccess(Bun.spawnSync(["git", "add", pkgPath], { cwd: ctx.root, stderr: "pipe" }), "git add")
    ensureSuccess(Bun.spawnSync(["git", "commit", "-m", tag], { cwd: ctx.root, stderr: "pipe" }), "git commit")
    ensureSuccess(Bun.spawnSync(["git", "tag", tag], { cwd: ctx.root, stderr: "pipe" }), "git tag")

    return { currentVersion, nextVersion, tag }
  },
  renderCli(result): string {
    const release = result as ReleaseResult
    return `${release.currentVersion} -> ${release.nextVersion}\nTagged ${release.tag}. Push with: git push && git push --tags`
  },
})
