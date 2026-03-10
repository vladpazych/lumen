import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import { ensureAuthKey, readAuthKey } from "./server-state";

const SERVER_TEMPLATE_VERSION = 1;
const AUTH_SECRET_NAME = "lumen-auth";
const ASSETS_ROOT = "assets";
const SERVER_BASE_DIR = "server/base";
const PIPELINE_PACKS_DIR = "server/packs";
const SKILL_PACKS_DIR = "skill-packs";

export type PackKind = "pipeline" | "skill";

export type PackDefinition = {
  id: string;
  kind: PackKind;
  name: string;
  description: string;
  sourceDir: string;
};

export type ManagedServerManifest = {
  templateVersion: number;
  authSecretName: string;
  installedPipelinePacks: string[];
  installedSkillPacks: string[];
  initializedGit: boolean;
  createdAt: string;
};

export type ServerSetupInfo = {
  serverPath: string;
  serverSetting: string;
  installed: boolean;
  managed: boolean;
  authToken: string | null;
  authSecretName: string;
  manifest: ManagedServerManifest | null;
  pipelinePacks: PackDefinition[];
  skillPacks: PackDefinition[];
  canCreateModalSecret: boolean;
};

export type InstallServerOptions = {
  context: vscode.ExtensionContext;
  serverSetting: string;
  pipelinePackIds: string[];
  skillPackIds: string[];
  initGit: boolean;
};

function manifestPath(serverPath: string): string {
  return join(serverPath, "lumen.template.json");
}

function schemaSnapshotPath(serverPath: string): string {
  return join(serverPath, "lumen.schema.json");
}

function assetsPath(context: vscode.ExtensionContext, ...parts: string[]): string {
  return join(context.extensionPath, ASSETS_ROOT, ...parts);
}

function readPackDefinitions(context: vscode.ExtensionContext, kind: PackKind): PackDefinition[] {
  const kindDir =
    kind === "pipeline"
      ? assetsPath(context, PIPELINE_PACKS_DIR)
      : assetsPath(context, SKILL_PACKS_DIR);
  if (!existsSync(kindDir)) {
    return [];
  }

  return readdirSync(kindDir)
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .flatMap((id): PackDefinition[] => {
      const sourceDir = join(kindDir, id);
      if (!statSync(sourceDir).isDirectory()) {
        return [];
      }

      const descriptorPath = join(sourceDir, "pack.json");
      const defaults = {
        id,
        kind,
        name: id,
        description: "",
      } satisfies Omit<PackDefinition, "sourceDir">;

      if (!existsSync(descriptorPath)) {
        return [{ ...defaults, sourceDir }];
      }

      const descriptor = JSON.parse(readFileSync(descriptorPath, "utf-8")) as {
        id?: string;
        name?: string;
        description?: string;
      };

      return [
        {
          id: descriptor.id ?? defaults.id,
          kind,
          name: descriptor.name ?? defaults.name,
          description: descriptor.description ?? defaults.description,
          sourceDir,
        },
      ];
    });
}

function readManifest(serverPath: string): ManagedServerManifest | null {
  const file = manifestPath(serverPath);
  if (!existsSync(file)) {
    return null;
  }

  return JSON.parse(readFileSync(file, "utf-8")) as ManagedServerManifest;
}

function writeManifest(serverPath: string, manifest: ManagedServerManifest): void {
  writeFileSync(manifestPath(serverPath), `${JSON.stringify(manifest, null, 2)}\n`);
}

function ensureEmptyOrManagedDirectory(targetPath: string): void {
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true });
    return;
  }

  const entries = readdirSync(targetPath).filter((entry) => entry !== ".DS_Store");
  if (entries.length === 0) {
    return;
  }

  if (existsSync(manifestPath(targetPath))) {
    return;
  }

  throw new Error(`Target path is not empty: ${targetPath}`);
}

function copyContents(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    if (entry === "pack.json") {
      continue;
    }
    cpSync(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
  }
}

function toStoredServerSetting(serverSetting: string, targetPath: string): string {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return serverSetting;
  }

  const absoluteTarget = resolve(targetPath);
  const absoluteRoot = resolve(workspaceRoot);
  const rel = relative(absoluteRoot, absoluteTarget);
  if (!rel.startsWith("..") && rel !== "") {
    return rel.replace(/\\/g, "/");
  }
  if (absoluteTarget === absoluteRoot) {
    return ".";
  }
  return serverSetting;
}

function ensureGitRepo(targetPath: string): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const gitRoot =
    workspaceRoot && resolve(targetPath).startsWith(resolve(workspaceRoot))
      ? workspaceRoot
      : targetPath;

  if (existsSync(join(gitRoot, ".git"))) {
    return;
  }

  const result = spawnSync("git", ["init"], {
    cwd: gitRoot,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || "git init failed");
  }
}

export function canCreateModalSecret(): boolean {
  const result = spawnSync("/bin/sh", ["-lc", "command -v modal >/dev/null 2>&1"], {
    encoding: "utf-8",
  });
  return result.status === 0;
}

export function writeSchemaSnapshot(serverPath: string, pipelines: unknown): void {
  if (!serverPath) {
    return;
  }

  try {
    mkdirSync(dirname(schemaSnapshotPath(serverPath)), { recursive: true });
    writeFileSync(schemaSnapshotPath(serverPath), `${JSON.stringify(pipelines, null, 2)}\n`);
  } catch {}
}

export function describeServerSetup(
  context: vscode.ExtensionContext,
  serverPath: string,
  serverSetting: string,
): ServerSetupInfo {
  const pipelinePacks = readPackDefinitions(context, "pipeline");
  const skillPacks = readPackDefinitions(context, "skill");
  const installed = existsSync(join(serverPath, "serve.py"));
  const manifest = installed ? readManifest(serverPath) : null;

  return {
    serverPath,
    serverSetting,
    installed,
    managed: manifest !== null,
    authToken: installed ? readAuthKey(serverPath) : null,
    authSecretName: manifest?.authSecretName ?? AUTH_SECRET_NAME,
    manifest,
    pipelinePacks,
    skillPacks,
    canCreateModalSecret: canCreateModalSecret(),
  };
}

export async function installServerTemplate(options: InstallServerOptions): Promise<ServerSetupInfo> {
  const { context, serverSetting, pipelinePackIds, skillPackIds, initGit } = options;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const resolvedSetting =
    workspaceRoot && !serverSetting.startsWith("/") && !serverSetting.startsWith("${workspaceFolder}")
      ? join(workspaceRoot, serverSetting)
      : serverSetting.replace(/\$\{workspaceFolder\}/g, workspaceRoot ?? "");

  const targetPath = resolve(resolvedSetting);
  ensureEmptyOrManagedDirectory(targetPath);
  const existingManifest = readManifest(targetPath);
  const isNewInstall = !existsSync(join(targetPath, "serve.py"));

  if (isNewInstall) {
    copyContents(assetsPath(context, SERVER_BASE_DIR), targetPath);
  }

  const pipelinePacks = readPackDefinitions(context, "pipeline");
  for (const packId of pipelinePackIds) {
    const pack = pipelinePacks.find((candidate) => candidate.id === packId);
    if (!pack) {
      throw new Error(`Unknown pipeline pack: ${packId}`);
    }
    copyContents(pack.sourceDir, targetPath);
  }

  const skillPacks = readPackDefinitions(context, "skill");
  const skillTarget = workspaceRoot ?? targetPath;
  for (const packId of skillPackIds) {
    const pack = skillPacks.find((candidate) => candidate.id === packId);
    if (!pack) {
      throw new Error(`Unknown skill pack: ${packId}`);
    }
    copyContents(pack.sourceDir, skillTarget);
  }

  ensureAuthKey(targetPath);
  if (isNewInstall) {
    writeSchemaSnapshot(targetPath, []);
  }
  writeManifest(targetPath, {
    templateVersion: SERVER_TEMPLATE_VERSION,
    authSecretName: AUTH_SECRET_NAME,
    installedPipelinePacks: [
      ...(existingManifest?.installedPipelinePacks ?? []),
      ...pipelinePackIds,
    ]
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort(),
    installedSkillPacks: [
      ...(existingManifest?.installedSkillPacks ?? []),
      ...skillPackIds,
    ]
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort(),
    initializedGit: existingManifest?.initializedGit ?? initGit,
    createdAt: existingManifest?.createdAt ?? new Date().toISOString(),
  });

  if (initGit && isNewInstall) {
    ensureGitRepo(targetPath);
  }

  const storedSetting = toStoredServerSetting(serverSetting, targetPath);
  await vscode.workspace
    .getConfiguration("lumen")
    .update("server", storedSetting, vscode.ConfigurationTarget.Workspace);

  return describeServerSetup(context, targetPath, storedSetting);
}

export async function revealServerFolder(serverPath: string): Promise<void> {
  await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(serverPath));
}

export function copyAuthToken(serverPath: string): string {
  const token = readAuthKey(serverPath);
  if (!token) {
    throw new Error("Auth token not found");
  }
  return token;
}

export function createOrUpdateModalSecret(serverPath: string, secretName: string): void {
  const token = readAuthKey(serverPath);
  if (!token) {
    throw new Error("Auth token not found");
  }

  const result = spawnSync(
    "modal",
    ["secret", "create", "--force", secretName, `LUMEN_AUTH_TOKEN=${token}`],
    {
      cwd: serverPath,
      encoding: "utf-8",
    },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || "modal secret create failed");
  }
}
