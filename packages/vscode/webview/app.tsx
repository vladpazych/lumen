import { useState } from "react";
import { Stack } from "./kit/stack";
import { Text } from "./kit/text";
import { Accordion, AccordionItem } from "./kit/accordion";
import { Header } from "./components/header";
import { ConfigCard } from "./components/config-card";
import { AddConfig } from "./components/add-config";
import { useLumen } from "./lib/use-lumen";

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
    updateParam,
    updateName,
    setFocus,
    requestGenerate,
    startDevServer,
    stopDevServer,
    pickImage,
    pickImageByUri,
    isPickingImage,
    imageThumbs,
  } = useLumen();

  const [showAddForm, setShowAddForm] = useState(false);

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Text color="secondary">Loading...</Text>
      </div>
    );
  }

  const serverUrls = Object.keys(schemas);

  if (serverUrls.length === 0 && configs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Stack spacing="normal">
          <Text variant="caption" color="secondary">
            No servers configured. Add servers to{" "}
            <span className="font-mono text-[11px] text-text-primary">
              lumen.servers
            </span>{" "}
            in VS Code settings.
          </Text>
        </Stack>
      </div>
    );
  }

  // Derive initial expanded key from focusIndex
  const focusedConfig = configs[focusIndex];
  const initialKey = focusedConfig?.id ?? null;

  const handleAddConfig = (service: string, pipeline: string) => {
    addConfig(service, pipeline, schemas, configs);
    setShowAddForm(false);
    // Focus the new config (will be at the end)
    setFocus(configs.length);
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Stack spacing="loose">
        <Header
          devServerUrl={devServerUrl}
          devServerState={devServerState}
          onStartServer={startDevServer}
          onStopServer={stopDevServer}
          onAddConfig={() => setShowAddForm(true)}
        />

        {configs.length === 0 && (
          <Text variant="caption" color="tertiary">
            No configurations yet. Click + Add to get started.
          </Text>
        )}

        <Accordion defaultValue={initialKey ? [initialKey] : undefined}>
          {configs.map((config, i) => {
            const schema = schemas[config.service]?.find(
              (p) => p.id === config.pipeline,
            );
            const status = serverStatuses[config.service] ?? "disconnected";
            const isGen = generating[config.id] ?? false;
            const prog = progress[config.id];
            const result = results[config.id];

            return (
              <AccordionItem
                key={config.id}
                value={config.id}
                onOpenChange={(open) => open && setFocus(i)}
              >
                <ConfigCard
                  config={config}
                  schema={schema}
                  serverName={serverNames[config.service]}
                  status={status}
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
                    pickImage(
                      config.id,
                      config.service,
                      config.pipeline,
                      paramName,
                    )
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
                  isPickingImage={isPickingImage}
                  imageThumbs={imageThumbs}
                />
              </AccordionItem>
            );
          })}
        </Accordion>

        {showAddForm && (
          <AddConfig
            schemas={schemas}
            serverStatuses={serverStatuses}
            serverNames={serverNames}
            onAdd={handleAddConfig}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </Stack>
    </div>
  );
}
