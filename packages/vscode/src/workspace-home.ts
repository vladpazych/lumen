import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import * as vscode from "vscode";
import {
  DEFAULT_LUMEN_SERVER_SETTING,
  DEFAULT_LUMEN_SKILL_PACK_IDS,
  describeServerSetup,
  installServerTemplate,
  reinstallManagedSkillPacks,
  revealServerFolder,
  updateManagedServerTemplate,
  type ServerSetupInfo,
} from "./server-scaffold";

export const LUMEN_WORKSPACE_FILE = "lumen.config.json";
export const LUMEN_ASSETS_DIR = "assets";
export const LUMEN_DEFAULT_CONFIG_FILE = "main.lumen";

export type WorkspaceConfigFile = {
  name: string;
  path: string;
  relativePath: string;
  uri: string;
};

export type WorkspaceHomeInfo = {
  workspaceRoot: string;
  homePath: string;
  assetsPath: string;
  initialized: boolean;
  configFiles: WorkspaceConfigFile[];
};

function requireWorkspaceRoot(): string {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    throw new Error("Open a workspace folder to use Lumen");
  }
  return root;
}

function workspaceConfigText(): string {
  return `${JSON.stringify({ version: 1 }, null, 2)}\n`;
}

function runnerConfigText(): string {
  return "[]\n";
}

function gitignoreEntries(): string[] {
  return ["assets/", ".agents/", ".claude/"];
}

function slugifyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nextConfigStem(configFiles: WorkspaceConfigFile[]): string {
  if (configFiles.length === 0) {
    return "main";
  }

  const names = new Set(
    configFiles.map((file) => file.name.replace(/\.lumen$/i, "")),
  );
  if (!names.has("config")) {
    return "config";
  }

  for (let index = 2; ; index++) {
    const candidate = `config-${index}`;
    if (!names.has(candidate)) {
      return candidate;
    }
  }
}

function pipelineTemplateText(serverPath: string, slug: string): string {
  const templatePath = join(serverPath, "pipelines", "_template.py");
  const template = readFileSync(templatePath, "utf-8");
  return template
    .replace('"id": "my-pipeline"', `"id": "${slug}"`)
    .replace('"name": "My Pipeline"', `"name": "${titleizeSlug(slug)}"`);
}

export function isWorkspaceHomeDocument(
  documentOrUri: vscode.TextDocument | vscode.Uri,
): boolean {
  const filePath =
    "uri" in documentOrUri ? documentOrUri.uri.fsPath : documentOrUri.fsPath;
  return basename(filePath) === LUMEN_WORKSPACE_FILE;
}

export function getWorkspaceHomePath(): string {
  return join(requireWorkspaceRoot(), LUMEN_WORKSPACE_FILE);
}

export function getAssetsRootPath(): string {
  return join(requireWorkspaceRoot(), LUMEN_ASSETS_DIR);
}

export function getManagedServerPath(): string {
  return join(requireWorkspaceRoot(), ...DEFAULT_LUMEN_SERVER_SETTING.split("/"));
}

export function describeWorkspaceHome(): WorkspaceHomeInfo {
  const workspaceRoot = requireWorkspaceRoot();
  const homePath = getWorkspaceHomePath();
  const assetsPath = getAssetsRootPath();
  const configFiles =
    existsSync(assetsPath)
      ? readdirSync(assetsPath)
          .filter((entry) => entry.endsWith(".lumen"))
          .slice()
          .sort((left, right) => left.localeCompare(right))
          .map((entry) => {
            const path = join(assetsPath, entry);
            return {
              name: entry,
              path,
              relativePath: `${LUMEN_ASSETS_DIR}/${entry}`,
              uri: vscode.Uri.file(path).toString(),
            } satisfies WorkspaceConfigFile;
          })
      : [];

  return {
    workspaceRoot,
    homePath,
    assetsPath,
    initialized: existsSync(join(getManagedServerPath(), "serve.py")),
    configFiles,
  };
}

export function describeManagedWorkspaceServer(
  context: vscode.ExtensionContext,
): ServerSetupInfo {
  return describeServerSetup(
    context,
    getManagedServerPath(),
    DEFAULT_LUMEN_SERVER_SETTING,
  );
}

export function ensureWorkspaceHomeDocument(): string {
  const homePath = getWorkspaceHomePath();
  if (!existsSync(homePath)) {
    writeFileSync(homePath, workspaceConfigText());
  }
  return homePath;
}

export function ensureWorkspaceGitignore(): void {
  const root = requireWorkspaceRoot();
  const gitignorePath = join(root, ".gitignore");
  const current = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf-8")
    : "";
  const lines = current
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let changed = false;

  for (const entry of gitignoreEntries()) {
    if (!lines.includes(entry)) {
      lines.push(entry);
      changed = true;
    }
  }

  if (changed || !existsSync(gitignorePath)) {
    const next = `${lines.join("\n")}\n`;
    writeFileSync(gitignorePath, next);
  }
}

export async function openWorkspaceHome(): Promise<void> {
  const homePath = ensureWorkspaceHomeDocument();
  await vscode.commands.executeCommand(
    "vscode.openWith",
    vscode.Uri.file(homePath),
    "lumen.stateViewer",
  );
}

function ensureRunnerConfig(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  if (!existsSync(filePath)) {
    writeFileSync(filePath, runnerConfigText());
  }
}

export async function initializeWorkspace(
  context: vscode.ExtensionContext,
): Promise<{
  home: WorkspaceHomeInfo;
  setup: ServerSetupInfo;
}> {
  ensureWorkspaceHomeDocument();
  ensureWorkspaceGitignore();
  const assetsPath = getAssetsRootPath();
  mkdirSync(assetsPath, { recursive: true });

  const setup = await installServerTemplate({
    context,
    serverSetting: DEFAULT_LUMEN_SERVER_SETTING,
    pipelinePackIds: [],
    skillPackIds: [...DEFAULT_LUMEN_SKILL_PACK_IDS],
    initGit: false,
  });

  ensureRunnerConfig(join(assetsPath, LUMEN_DEFAULT_CONFIG_FILE));
  return {
    home: describeWorkspaceHome(),
    setup,
  };
}

export async function createRunnerConfigFromPrompt(): Promise<WorkspaceHomeInfo> {
  const home = describeWorkspaceHome();
  mkdirSync(home.assetsPath, { recursive: true });

  const value = await vscode.window.showInputBox({
    title: "Create Lumen Config",
    prompt: "Name the new runner config",
    value: nextConfigStem(home.configFiles),
    validateInput: (input) =>
      slugifyName(input) ? undefined : "Use letters, numbers, spaces, or dashes",
  });
  if (value === undefined) {
    return home;
  }

  const stem = slugifyName(value);
  const filePath = join(home.assetsPath, `${stem}.lumen`);
  if (existsSync(filePath)) {
    throw new Error(`Config already exists: assets/${stem}.lumen`);
  }

  writeFileSync(filePath, runnerConfigText());
  await vscode.commands.executeCommand(
    "vscode.openWith",
    vscode.Uri.file(filePath),
    "lumen.stateViewer",
  );
  return describeWorkspaceHome();
}

export async function openRunnerConfig(uri: string): Promise<void> {
  const target = vscode.Uri.parse(uri);
  await vscode.commands.executeCommand("vscode.openWith", target, "lumen.stateViewer");
}

export async function createPipelineFromPrompt(): Promise<string | null> {
  const serverPath = getManagedServerPath();
  if (!existsSync(join(serverPath, "serve.py"))) {
    throw new Error("Initialize the Lumen workspace before creating pipelines");
  }

  const value = await vscode.window.showInputBox({
    title: "Create Pipeline",
    prompt: "Name the new pipeline",
    value: "my-pipeline",
    validateInput: (input) =>
      slugifyName(input) ? undefined : "Use letters, numbers, spaces, or dashes",
  });
  if (value === undefined) {
    return null;
  }

  const slug = slugifyName(value);
  const filePath = join(serverPath, "pipelines", `${slug}.py`);
  if (existsSync(filePath)) {
    throw new Error(`Pipeline already exists: assets/server/pipelines/${slug}.py`);
  }

  writeFileSync(filePath, pipelineTemplateText(serverPath, slug));
  await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  return filePath;
}

export async function updateWorkspaceRuntime(
  context: vscode.ExtensionContext,
): Promise<ServerSetupInfo> {
  return updateManagedServerTemplate(context, DEFAULT_LUMEN_SERVER_SETTING);
}

export async function reinstallWorkspaceSkills(
  context: vscode.ExtensionContext,
): Promise<ServerSetupInfo> {
  await reinstallManagedSkillPacks(context, [...DEFAULT_LUMEN_SKILL_PACK_IDS]);
  return describeManagedWorkspaceServer(context);
}

export async function revealAssetsFolder(): Promise<void> {
  const assetsPath = getAssetsRootPath();
  mkdirSync(assetsPath, { recursive: true });
  await revealServerFolder(assetsPath);
}
