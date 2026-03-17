import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/status-dot";
import { ConfigCard } from "@/components/config-card";
import { ServerLog } from "@/components/server-log";
import { AddConfigDialog } from "@/components/add-config-dialog";
import { SetupPanel } from "@/components/setup-panel";
import { WorkspaceHome } from "@/components/workspace-home";
import { useLumen } from "@/lib/use-lumen";
import { vscode } from "@/lib/vscode";

type PersistedState = { expandedIds?: string[] };

function loadExpanded(): Set<string> {
  const state = vscode.getState<PersistedState>();
  return new Set(state?.expandedIds ?? []);
}

function saveExpanded(ids: Set<string>): void {
  vscode.setState<PersistedState>({ expandedIds: [...ids] });
}

const statusVariant = {
  connected: "success",
  error: "destructive",
  disconnected: "muted",
} as const;

export function App() {
  const {
    schemas,
    configs,
    serverStatuses,
    devServerState,
    devServerLog,
    devServerUrl,
    documentKind,
    serverSetup,
    workspaceHome,
    installingServer,
    generating,
    progress,
    stage,
    results,
    ready,
    addConfig,
    removeConfig,
    updateParam,
    updateName,
    setFocus,
    requestGenerate,
    startDevServer,
    stopDevServer,
    restartDevServer,
    installServer,
    copyServerAuthToken,
    createModalSecret,
    revealServer,
    initializeWorkspace,
    createRunnerConfig,
    openRunnerConfig,
    createPipeline,
    updateRuntime,
    reinstallSkills,
    revealAssets,
    pickImage,
    pickImageByUri,
    isPickingImage,
    imageThumbs,
  } = useLumen();

  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState(loadExpanded);

  const toggleCard = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveExpanded(next);
      return next;
    });
  }, []);

  if (!ready) {
    return (
      <div className="p-4">
        <p className="text-text-secondary text-[12px]">Loading...</p>
      </div>
    );
  }

  const serverUrl = devServerUrl;
  const status = serverUrl
    ? (serverStatuses[serverUrl] ?? "disconnected")
    : "disconnected";
  const pipelines = serverUrl ? (schemas[serverUrl] ?? []) : [];

  const canStart =
    serverSetup.installed &&
    (devServerState === "stopped" ||
      devServerState === "error" ||
      devServerState === "orphaned");
  const canStop =
    serverSetup.installed &&
    (devServerState === "running" ||
      devServerState === "starting" ||
      devServerState === "rebuilding");
  const canRestart =
    serverSetup.installed &&
    (devServerState === "running" || devServerState === "rebuilding");
  const isRebuilding = devServerState === "rebuilding";
  const isStopping = devServerState === "stopping";
  const isOrphaned = devServerState === "orphaned";

  const handleAddConfig = (pipeline: string) => {
    if (!serverUrl) return;
    addConfig(serverUrl, pipeline, schemas, configs);
    setShowAddForm(false);
    setFocus(configs.length);
  };

  if (documentKind === "workspace") {
    return (
      <TooltipProvider>
        <div className="p-3 flex flex-col gap-3">
          <WorkspaceHome
            setup={serverSetup}
            home={workspaceHome}
            status={status}
            devServerState={devServerState}
            installing={installingServer}
            canStart={canStart}
            canStop={canStop}
            canRestart={canRestart}
            onInitialize={initializeWorkspace}
            onStartServer={startDevServer}
            onStopServer={stopDevServer}
            onRestartServer={restartDevServer}
            onCreatePipeline={createPipeline}
            onCreateConfig={createRunnerConfig}
            onOpenConfig={openRunnerConfig}
            onUpdateRuntime={updateRuntime}
            onReinstallSkills={reinstallSkills}
            onCopyAuthToken={copyServerAuthToken}
            onCreateModalSecret={createModalSecret}
            onRevealAssets={revealAssets}
          />

          {serverSetup.installed && devServerLog.length > 0 && (
            <div className="rounded-md border border-border bg-card">
              <div className="px-3 py-2 text-[12px] text-text-secondary">
                Server Log
              </div>
              <ServerLog lines={devServerLog} />
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-3 flex flex-col gap-3">
        <SetupPanel
          setup={serverSetup}
          installing={installingServer}
          onInstall={installServer}
          onCopyAuthToken={copyServerAuthToken}
          onCreateModalSecret={createModalSecret}
          onRevealServer={revealServer}
        />

        {serverSetup.installed && (
          <div className="rounded-md border border-border bg-card">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <StatusDot variant={statusVariant[status]} size="sm" />
                {canStart && (
                  <Button variant="ghost" size="xs" onClick={startDevServer}>
                    {isOrphaned ? "Replace" : "Start"}
                  </Button>
                )}
                {canRestart && (
                  <Button variant="ghost" size="xs" onClick={restartDevServer}>
                    Restart
                  </Button>
                )}
                {canStop && (
                  <Button variant="ghost" size="xs" onClick={stopDevServer}>
                    {devServerState === "starting" ? "Starting…" : "Stop"}
                  </Button>
                )}
                {isRebuilding && (
                  <span className="text-[10px] text-warning animate-pulse">
                    Rebuilding…
                  </span>
                )}
                {isOrphaned && (
                  <span className="text-[10px] text-warning">No process</span>
                )}
                {isStopping && (
                  <span className="text-[10px] text-text-tertiary animate-pulse">
                    Stopping…
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShowAddForm(true)}
                disabled={pipelines.length === 0}
              >
                + Add
              </Button>
            </div>
            {devServerLog.length > 0 && <ServerLog lines={devServerLog} />}
          </div>
        )}

        {/* Config cards */}
        {configs.map((config, i) => {
          const schema = pipelines.find((p) => p.id === config.pipeline);
          const isGen = generating[config.id] ?? false;
          const prog = progress[config.id];
          const stg = stage[config.id];
          const result = results[config.id];

          return (
            <ConfigCard
              key={config.id}
              config={config}
              schema={schema}
              status={status}
              open={expanded.has(config.id)}
              onToggle={() => {
                toggleCard(config.id);
                setFocus(i);
              }}
              isGenerating={isGen}
              progress={prog}
              stage={stg}
              result={result}
              onParamChange={(paramName, value) =>
                updateParam(
                  config.id,
                  config.service,
                  config.pipeline,
                  paramName,
                  value,
                )
              }
              onGenerate={(params) =>
                requestGenerate(
                  config.id,
                  config.service,
                  config.pipeline,
                  params,
                )
              }
              onPickImage={(paramName) =>
                pickImage(config.id, config.service, config.pipeline, paramName)
              }
              onPickImageByUri={(paramName, uri) =>
                pickImageByUri(
                  config.id,
                  config.service,
                  config.pipeline,
                  paramName,
                  uri,
                )
              }
              onRename={(name) => updateName(config.id, name)}
              onRemove={() => removeConfig(config.id)}
              isPickingImage={isPickingImage}
              imageThumbs={imageThumbs}
            />
          );
        })}

        {configs.length === 0 && pipelines.length > 0 && (
          <p className="text-[11px] text-text-tertiary px-1">
            No configurations yet. Click + Add to get started.
          </p>
        )}

        {configs.length === 0 && !serverSetup.installed && (
          <p className="text-[11px] text-text-tertiary px-1">
            Install a server to start discovering pipelines for this workspace.
          </p>
        )}

        {configs.length === 0 && serverSetup.installed && !serverUrl && (
          <p className="text-[11px] text-text-tertiary px-1">
            Start the dev server to load pipelines for this workspace.
          </p>
        )}

        {showAddForm && (
          <AddConfigDialog
            pipelines={pipelines}
            onAdd={handleAddConfig}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
