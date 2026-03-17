import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import { assertModalMachineAuth, describeModalMachineAuth } from "./modal-auth";
import { writeAuthKey } from "./server-state";
import type { WorkspaceSecretStore } from "./workspace-secrets";

const SERVER_TEMPLATE_VERSION = 1;
const SKILL_PACK_VERSION = 1;
const AUTH_SECRET_NAME = "lumen-auth";
const ASSETS_ROOT = "assets";
const SERVER_BASE_DIR = "server/base";
const PIPELINE_PACKS_DIR = "server/packs";
const SKILL_PACKS_DIR = "skill-packs";
const MANAGED_SKILL_PREFIX = "lumen-";

export const DEFAULT_LUMEN_SERVER_SETTING = "server";
export const DEFAULT_LUMEN_SKILL_PACK_IDS = [
  "pipeline",
  "lumen-file",
  "generation",
] as const;

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
  skillPackVersion: number;
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
  authSecretName: string;
  manifest: ManagedServerManifest | null;
  pipelinePacks: PackDefinition[];
  skillPacks: PackDefinition[];
  canCreateModalSecret: boolean;
};

export type InstallServerOptions = {
  context: vscode.ExtensionContext;
  workspaceSecrets: WorkspaceSecretStore;
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
    if (entry === "pack.json" || entry === "AGENTS.md") {
      continue;
    }
    cpSync(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
  }
}

function copyManagedRuntimeShell(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    if (entry === "pipelines" || entry === "AGENTS.md") {
      continue;
    }
    cpSync(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
  }
}

function managedSkillTargetDirs(workspaceRoot: string, packId: string): string[] {
  const dirName = `${MANAGED_SKILL_PREFIX}${packId}`;
  return [
    join(workspaceRoot, ".agents", "skills", dirName),
    join(workspaceRoot, ".claude", "skills", dirName),
  ];
}

function installSkillPackIntoWorkspace(
  pack: PackDefinition,
  workspaceRoot: string,
): void {
  for (const targetDir of managedSkillTargetDirs(workspaceRoot, pack.id)) {
    rmSync(targetDir, { recursive: true, force: true });
    copyContents(pack.sourceDir, targetDir);
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
  return describeModalMachineAuth().cliInstalled;
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
    authSecretName: manifest?.authSecretName ?? AUTH_SECRET_NAME,
    manifest,
    pipelinePacks,
    skillPacks,
    canCreateModalSecret: canCreateModalSecret(),
  };
}

export async function installServerTemplate(options: InstallServerOptions): Promise<ServerSetupInfo> {
  const {
    context,
    workspaceSecrets,
    serverSetting,
    pipelinePackIds,
    skillPackIds,
    initGit,
  } = options;
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
    installSkillPackIntoWorkspace(pack, skillTarget);
  }

  const authToken = await workspaceSecrets.getLumenAuthToken(targetPath);
  writeAuthKey(targetPath, authToken);
  if (isNewInstall) {
    writeSchemaSnapshot(targetPath, []);
  }
  writeManifest(targetPath, {
    templateVersion: SERVER_TEMPLATE_VERSION,
    skillPackVersion: SKILL_PACK_VERSION,
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

export async function copyAuthToken(
  workspaceSecrets: WorkspaceSecretStore,
  serverPath: string,
): Promise<string> {
  return workspaceSecrets.getLumenAuthToken(serverPath);
}

export async function createOrUpdateModalSecret(
  workspaceSecrets: WorkspaceSecretStore,
  serverPath: string,
  secretName: string,
): Promise<void> {
  assertModalMachineAuth();
  const token = await workspaceSecrets.getLumenAuthToken(serverPath);

  const result = spawnSync(
    "modal",
    ["secret", "create", "--force", secretName, `LUMEN_AUTH_TOKEN=${token}`],
    {
      cwd: serverPath,
      encoding: "utf-8",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || "modal secret create failed");
  }
}

export async function updateManagedServerTemplate(
  context: vscode.ExtensionContext,
  serverSetting: string,
): Promise<ServerSetupInfo> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const resolvedSetting =
    workspaceRoot && !serverSetting.startsWith("/") && !serverSetting.startsWith("${workspaceFolder}")
      ? join(workspaceRoot, serverSetting)
      : serverSetting.replace(/\$\{workspaceFolder\}/g, workspaceRoot ?? "");

  const targetPath = resolve(resolvedSetting);
  const manifest = readManifest(targetPath);
  if (!manifest) {
    throw new Error("Lumen-managed server not found");
  }

  copyManagedRuntimeShell(assetsPath(context, SERVER_BASE_DIR), targetPath);
  writeManifest(targetPath, {
    ...manifest,
    templateVersion: SERVER_TEMPLATE_VERSION,
    skillPackVersion: SKILL_PACK_VERSION,
  });

  return describeServerSetup(context, targetPath, serverSetting);
}

export async function reinstallManagedSkillPacks(
  context: vscode.ExtensionContext,
  skillPackIds: string[],
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    throw new Error("Open a workspace folder to install Lumen skills");
  }

  const skillPacks = readPackDefinitions(context, "skill");
  for (const packId of skillPackIds) {
    const pack = skillPacks.find((candidate) => candidate.id === packId);
    if (!pack) {
      throw new Error(`Unknown skill pack: ${packId}`);
    }
    installSkillPackIntoWorkspace(pack, workspaceRoot);
  }
}
