import { useState } from "react";
import type {
  DevServerState,
  ServerSetupInfo,
  WorkspaceAuthInfo,
  WorkspaceHomeInfo,
} from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/status-dot";

const serverVariant = {
  connected: "success",
  error: "destructive",
  disconnected: "muted",
} as const;

const authVariant = {
  ready: "success",
  missing: "muted",
} as const;

const devStateLabel: Record<DevServerState, string> = {
  stopped: "Stopped",
  starting: "Starting",
  rebuilding: "Rebuilding",
  running: "Running",
  stopping: "Stopping",
  orphaned: "Detached",
  error: "Error",
};

type Props = {
  setup: ServerSetupInfo;
  auth: WorkspaceAuthInfo;
  home: WorkspaceHomeInfo;
  status: "connected" | "error" | "disconnected";
  devServerState: DevServerState;
  installing: boolean;
  canStart: boolean;
  canStop: boolean;
  canRestart: boolean;
  onInitialize: () => void;
  onStartServer: () => void;
  onStopServer: () => void;
  onRestartServer: () => void;
  onCreatePipeline: () => void;
  onCreateConfig: () => void;
  onOpenConfig: (uri: string) => void;
  onUpdateRuntime: () => void;
  onReinstallSkills: () => void;
  onCopyAuthToken: () => void;
  onSaveModalCredentials: (tokenId: string, tokenSecret: string) => void;
  onSyncLumenAuthToModal: () => void;
  onRevealAssets: () => void;
};

function AuthStatus({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-[11px] text-text-secondary">
      <StatusDot variant={authVariant[ready ? "ready" : "missing"]} size="sm" />
      {label}: {ready ? "Saved" : "Missing"}
    </div>
  );
}

export function WorkspaceHome({
  setup,
  auth,
  home,
  status,
  devServerState,
  installing,
  canStart,
  canStop,
  canRestart,
  onInitialize,
  onStartServer,
  onStopServer,
  onRestartServer,
  onCreatePipeline,
  onCreateConfig,
  onOpenConfig,
  onUpdateRuntime,
  onReinstallSkills,
  onCopyAuthToken,
  onSaveModalCredentials,
  onSyncLumenAuthToModal,
  onRevealAssets,
}: Props) {
  const [tokenId, setTokenId] = useState("");
  const [tokenSecret, setTokenSecret] = useState("");

  const handleSaveModalCredentials = () => {
    onSaveModalCredentials(tokenId, tokenSecret);
    setTokenSecret("");
  };

  return (
    <div className="flex flex-col gap-3">
      {!setup.installed && (
        <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[16px] font-medium text-text-primary">Lumen Workspace</h1>
            <p className="text-[12px] text-text-secondary">
              Initialize Lumen to create a managed Modal runtime in <code>assets/</code>,
              install default agent skills, and create your first <code>.lumen</code>{" "}
              config.
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface-1 px-3 py-2 text-[11px] text-text-tertiary">
            Creates: <code>{home.homePath}</code>, <code>{home.assetsPath}</code>,{" "}
            <code>assets/main.lumen</code>, <code>.agents/skills/</code>, and{" "}
            <code>.claude/skills/</code>.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" onClick={onInitialize} disabled={installing}>
              {installing ? "Initializing…" : "Initialize Lumen Workspace"}
            </Button>
            <Button variant="outline" onClick={onRevealAssets}>
              Reveal Assets Folder
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-medium text-text-primary">Auth</h2>
            <p className="text-[11px] text-text-tertiary">
              Save Modal credentials in VS Code secrets. Lumen keeps its bearer token in
              VS Code secrets too, then writes <code>assets/server/.authkey</code> only
              when the local runtime needs it.
            </p>
          </div>
          <div className="rounded-md bg-surface-1 px-2.5 py-2 text-[11px] text-text-tertiary">
            Modal secret: <span className="text-text-primary">{auth.modalSecretName}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AuthStatus label="Modal credentials" ready={auth.modalCredentialsSaved} />
          <AuthStatus label="Lumen auth token" ready={auth.lumenAuthTokenSaved} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="modal-token-id">Modal token ID</Label>
            <Input
              id="modal-token-id"
              value={tokenId}
              onChange={(event) => setTokenId(event.target.value)}
              placeholder="ak-..."
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="modal-token-secret">Modal token secret</Label>
            <Input
              id="modal-token-secret"
              type="password"
              value={tokenSecret}
              onChange={(event) => setTokenSecret(event.target.value)}
              placeholder="as-..."
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="accent"
            onClick={handleSaveModalCredentials}
            disabled={!tokenId.trim() || !tokenSecret.trim()}
          >
            Save Modal Credentials
          </Button>
          <Button variant="outline" onClick={onCopyAuthToken} disabled={!auth.lumenAuthTokenSaved}>
            Copy Lumen Auth Token
          </Button>
          <Button
            variant="outline"
            onClick={onSyncLumenAuthToModal}
            disabled={
              !setup.canCreateModalSecret ||
              !auth.modalCredentialsSaved ||
              !auth.lumenAuthTokenSaved
            }
          >
            Sync Lumen Auth to Modal
          </Button>
        </div>

        {!setup.canCreateModalSecret && (
          <p className="text-[11px] text-text-tertiary">
            Install the Modal CLI locally to sync the <code>{auth.modalSecretName}</code>{" "}
            secret from this workspace.
          </p>
        )}
      </div>

      {setup.installed && (
        <>
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="text-[16px] font-medium text-text-primary">Lumen Workspace</h1>
                <p className="text-[12px] text-text-secondary">
                  Home for your managed runtime, pipeline files, agent skills, and runner
                  configs.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-[11px] text-text-secondary">
                <StatusDot variant={serverVariant[status]} size="sm" />
                {devStateLabel[devServerState]}
              </div>
            </div>

            <div className="grid gap-2 text-[11px] text-text-tertiary sm:grid-cols-2">
              <div className="rounded-md bg-surface-1 px-2.5 py-2">
                Assets folder: <span className="text-text-primary">{home.assetsPath}</span>
              </div>
              <div className="rounded-md bg-surface-1 px-2.5 py-2">
                Runtime: <span className="text-text-primary">{setup.serverPath}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canStart && (
                <Button variant="accent" onClick={onStartServer}>
                  Start Server
                </Button>
              )}
              {canRestart && (
                <Button variant="outline" onClick={onRestartServer}>
                  Restart Server
                </Button>
              )}
              {canStop && (
                <Button variant="outline" onClick={onStopServer}>
                  Stop Server
                </Button>
              )}
              <Button variant="outline" onClick={onCreatePipeline}>
                Create Pipeline
              </Button>
              <Button variant="outline" onClick={onCreateConfig}>
                Create Config
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-medium text-text-primary">Runner Configs</h2>
                <p className="text-[11px] text-text-tertiary">
                  User-facing <code>.lumen</code> files in <code>assets/</code>.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onCreateConfig}>
                New Config
              </Button>
            </div>

            {home.configFiles.length === 0 ? (
              <div className="rounded-md bg-surface-1 px-3 py-3 text-[11px] text-text-tertiary">
                No runner configs yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {home.configFiles.map((file) => (
                  <button
                    key={file.uri}
                    className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-left hover:bg-surface-2"
                    onClick={() => onOpenConfig(file.uri)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] text-text-primary">{file.name}</span>
                      <span className="text-[11px] text-text-tertiary">
                        {file.relativePath}
                      </span>
                    </div>
                    <span className="text-[11px] text-primary">Open</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <div>
              <h2 className="text-[13px] font-medium text-text-primary">Workspace Tools</h2>
              <p className="text-[11px] text-text-tertiary">
                Safe maintenance for the managed runtime and bundled agent skills.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onUpdateRuntime}>
                Update Runtime
              </Button>
              <Button variant="outline" onClick={onReinstallSkills}>
                Reinstall Skills
              </Button>
              <Button variant="outline" onClick={onRevealAssets}>
                Reveal Assets Folder
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
