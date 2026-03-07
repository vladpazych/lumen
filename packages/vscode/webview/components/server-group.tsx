import type {
  LumenConfig,
  PipelineConfig,
  ServerStatus,
} from "@lumen/core/types";
import type { DevServerState } from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { StatusDot } from "@/components/status-dot";
import { ConfigCard } from "@/components/config-card";

type Props = {
  serverUrl: string;
  serverName?: string;
  status: ServerStatus;
  configs: LumenConfig[];
  pipelines: PipelineConfig[];
  focusIndex: number;
  generating: Record<string, boolean>;
  progress: Record<string, number>;
  results: Record<
    string,
    { imageUrl?: string; error?: string; metadata?: Record<string, unknown> }
  >;
  isPickingImage: boolean;
  imageThumbs: Record<string, string>;
  isDevServer: boolean;
  devServerState: DevServerState;
  onStartServer: () => void;
  onStopServer: () => void;
  onParamChange: (
    configId: string,
    service: string,
    pipeline: string,
    paramName: string,
    value: unknown,
  ) => void;
  onGenerate: (
    configId: string,
    service: string,
    pipeline: string,
    params: Record<string, unknown>,
  ) => void;
  onPickImage: (
    configId: string,
    service: string,
    pipeline: string,
    paramName: string,
  ) => void;
  onPickImageByUri: (
    configId: string,
    service: string,
    pipeline: string,
    paramName: string,
    uri: string,
  ) => void;
  onRename: (configId: string, name: string) => void;
  onRemove: (configId: string) => void;
  onFocus: (index: number) => void;
  globalIndexOffset: number;
};

const statusVariant = {
  connected: "success",
  error: "destructive",
  disconnected: "muted",
} as const;

function shortenUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^provider:\/\//, "")
    .replace(/\/$/, "");
}

export function ServerGroup({
  serverUrl,
  serverName,
  status,
  configs,
  pipelines,
  focusIndex,
  generating,
  progress,
  results,
  isPickingImage,
  imageThumbs,
  isDevServer,
  devServerState,
  onStartServer,
  onStopServer,
  onParamChange,
  onGenerate,
  onPickImage,
  onPickImageByUri,
  onRename,
  onRemove,
  onFocus,
  globalIndexOffset,
}: Props) {
  const label = serverName ?? shortenUrl(serverUrl);
  const canStart = devServerState === "stopped" || devServerState === "error";
  const canStop = devServerState === "running" || devServerState === "starting";

  const focusedConfig = configs[focusIndex - globalIndexOffset];
  const initialKey = focusedConfig?.id ?? null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2">
          <StatusDot variant={statusVariant[status]} size="sm" />
          <span className="text-[11px] font-medium text-text-secondary">
            {label}
          </span>
        </div>
        {isDevServer && (
          <div className="flex items-center gap-1">
            {canStart && (
              <Button variant="ghost" size="xs" onClick={onStartServer}>
                Start
              </Button>
            )}
            {canStop && (
              <Button variant="ghost" size="xs" onClick={onStopServer}>
                {devServerState === "starting" ? "Starting..." : "Stop"}
              </Button>
            )}
          </div>
        )}
      </div>

      {configs.length > 0 && (
        <Accordion defaultValue={initialKey ? [initialKey] : undefined}>
          {configs.map((config, i) => {
            const schema = pipelines.find((p) => p.id === config.pipeline);
            const isGen = generating[config.id] ?? false;
            const prog = progress[config.id];
            const result = results[config.id];

            return (
              <AccordionItem
                key={config.id}
                value={config.id}
                onOpenChange={(open) => open && onFocus(globalIndexOffset + i)}
              >
                <ConfigCard
                  config={config}
                  schema={schema}
                  serverName={serverName}
                  status={status}
                  isGenerating={isGen}
                  progress={prog}
                  result={result}
                  onParamChange={(paramName, value) =>
                    onParamChange(
                      config.id,
                      config.service,
                      config.pipeline,
                      paramName,
                      value,
                    )
                  }
                  onGenerate={(params) =>
                    onGenerate(
                      config.id,
                      config.service,
                      config.pipeline,
                      params,
                    )
                  }
                  onPickImage={(paramName) =>
                    onPickImage(
                      config.id,
                      config.service,
                      config.pipeline,
                      paramName,
                    )
                  }
                  onPickImageByUri={(paramName, uri) =>
                    onPickImageByUri(
                      config.id,
                      config.service,
                      config.pipeline,
                      paramName,
                      uri,
                    )
                  }
                  onRename={(name) => onRename(config.id, name)}
                  onRemove={() => onRemove(config.id)}
                  isPickingImage={isPickingImage}
                  imageThumbs={imageThumbs}
                />
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
