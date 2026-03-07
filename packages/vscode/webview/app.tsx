import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/status-dot";
import { ConfigCard } from "@/components/config-card";
import { ServerLog } from "@/components/server-log";
import { AddConfigDialog } from "@/components/add-config-dialog";
import { useLumen } from "@/lib/use-lumen";

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
    focusIndex,
    generating,
    progress,
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
    pickImage,
    pickImageByUri,
    isPickingImage,
    imageThumbs,
  } = useLumen();

  const [showAddForm, setShowAddForm] = useState(false);

  if (!ready) {
    return (
      <div className="p-4">
        <p className="text-text-secondary text-[12px]">Loading...</p>
      </div>
    );
  }

  const serverUrl = devServerUrl ?? Object.keys(schemas)[0];
  const status = serverUrl
    ? (serverStatuses[serverUrl] ?? "disconnected")
    : "disconnected";
  const pipelines = serverUrl ? (schemas[serverUrl] ?? []) : [];

  const canStart =
    devServerState === "stopped" ||
    devServerState === "error" ||
    devServerState === "orphaned";
  const canStop =
    devServerState === "running" ||
    devServerState === "starting" ||
    devServerState === "rebuilding";
  const canRestart =
    devServerState === "running" || devServerState === "rebuilding";
  const isRebuilding = devServerState === "rebuilding";
  const isStopping = devServerState === "stopping";
  const isOrphaned = devServerState === "orphaned";

  const focusedConfig = configs[focusIndex];
  const initialKey = focusedConfig?.id ?? null;

  const handleAddConfig = (pipeline: string) => {
    if (!serverUrl) return;
    addConfig(serverUrl, pipeline, schemas, configs);
    setShowAddForm(false);
    setFocus(configs.length);
  };

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Header card */}
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
        {devServerLog.length > 0 && (
          <div className="px-3 pb-2">
            <ServerLog lines={devServerLog} />
          </div>
        )}
      </div>

      {/* Config cards */}
      {configs.map((config, i) => {
        const schema = pipelines.find((p) => p.id === config.pipeline);
        const isGen = generating[config.id] ?? false;
        const prog = progress[config.id];
        const result = results[config.id];

        return (
          <ConfigCard
            key={config.id}
            config={config}
            schema={schema}
            status={status}
            defaultOpen={config.id === initialKey}
            isGenerating={isGen}
            progress={prog}
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
            onOpen={() => setFocus(i)}
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

      {showAddForm && (
        <AddConfigDialog
          pipelines={pipelines}
          onAdd={handleAddConfig}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
