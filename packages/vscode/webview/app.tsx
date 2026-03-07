import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ServerGroup } from "@/components/server-group";
import { AddConfigDialog } from "@/components/add-config-dialog";
import { useLumen } from "@/lib/use-lumen";

export function App() {
  const {
    schemas,
    configs,
    serverStatuses,
    serverNames,
    devServerState,
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
    isDevServer,
    pickImage,
    pickImageByUri,
    isPickingImage,
    imageThumbs,
  } = useLumen();

  const [showAddForm, setShowAddForm] = useState(false);

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  const serverUrls = Object.keys(schemas);

  if (serverUrls.length === 0 && configs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-[11px] text-text-secondary">
          No servers configured. Add servers to{" "}
          <span className="font-mono text-[11px] text-text-primary">
            lumen.servers
          </span>{" "}
          in VS Code settings.
        </p>
      </div>
    );
  }

  // Group configs by server URL, seeded from schema keys
  const serverConfigMap = new Map<string, typeof configs>();
  for (const url of serverUrls) {
    serverConfigMap.set(url, []);
  }
  for (const config of configs) {
    const existing = serverConfigMap.get(config.service) ?? [];
    existing.push(config);
    serverConfigMap.set(config.service, existing);
  }

  const handleAddConfig = (service: string, pipeline: string) => {
    addConfig(service, pipeline, schemas, configs);
    setShowAddForm(false);
    setFocus(configs.length);
  };

  let globalOffset = 0;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            + Add
          </Button>
        </div>

        {[...serverConfigMap.entries()].map(([serverUrl, serverConfigs], i) => {
          const offset = globalOffset;
          globalOffset += serverConfigs.length;
          return (
            <div key={serverUrl}>
              {i > 0 && <Separator className="mb-4" />}
              <ServerGroup
                serverUrl={serverUrl}
                serverName={serverNames[serverUrl]}
                status={serverStatuses[serverUrl] ?? "disconnected"}
                configs={serverConfigs}
                pipelines={schemas[serverUrl] ?? []}
                focusIndex={focusIndex}
                generating={generating}
                progress={progress}
                results={results}
                isPickingImage={isPickingImage}
                imageThumbs={imageThumbs}
                isDevServer={isDevServer(serverUrl)}
                devServerState={devServerState}
                onStartServer={startDevServer}
                onStopServer={stopDevServer}
                onRestartServer={restartDevServer}
                onParamChange={(
                  configId,
                  service,
                  pipeline,
                  paramName,
                  value,
                ) => updateParam(configId, service, pipeline, paramName, value)}
                onGenerate={(configId, service, pipeline, params) =>
                  requestGenerate(configId, service, pipeline, params)
                }
                onPickImage={(configId, service, pipeline, paramName) =>
                  pickImage(configId, service, pipeline, paramName)
                }
                onPickImageByUri={(
                  configId,
                  service,
                  pipeline,
                  paramName,
                  uri,
                ) =>
                  pickImageByUri(configId, service, pipeline, paramName, uri)
                }
                onRename={(configId, name) => updateName(configId, name)}
                onRemove={(configId) => removeConfig(configId)}
                onFocus={setFocus}
                globalIndexOffset={offset}
              />
            </div>
          );
        })}

        {configs.length === 0 && (
          <p className="text-[11px] text-text-tertiary">
            No configurations yet. Click + Add to get started.
          </p>
        )}

        {showAddForm && (
          <AddConfigDialog
            schemas={schemas}
            serverStatuses={serverStatuses}
            serverNames={serverNames}
            onAdd={handleAddConfig}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  );
}
