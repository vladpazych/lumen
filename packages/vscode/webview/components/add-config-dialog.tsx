import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusDot } from "@/components/status-dot";
import type { PipelineConfig, ServerStatus } from "@lumen/core/types";

type Props = {
  schemas: Record<string, PipelineConfig[]>;
  serverStatuses: Record<string, ServerStatus>;
  serverNames: Record<string, string>;
  onAdd: (service: string, pipeline: string) => void;
  onCancel: () => void;
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

export function AddConfigDialog({
  schemas,
  serverStatuses,
  serverNames,
  onAdd,
  onCancel,
}: Props) {
  const [service, setService] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<string | null>(null);

  const serviceUrls = Object.keys(schemas);
  const availablePipelines = service ? (schemas[service] ?? []) : [];

  const handleServiceChange = (url: string | null) => {
    if (!url) return;
    setService(url);
    setPipeline(null);
  };

  const handleAdd = () => {
    if (service && pipeline) {
      onAdd(service, pipeline);
    }
  };

  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex flex-col gap-3">
        <Select
          value={service ?? undefined}
          onValueChange={handleServiceChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select service..." />
          </SelectTrigger>
          <SelectContent>
            {serviceUrls.map((url) => (
              <SelectItem key={url} value={url}>
                <div className="flex items-center gap-2">
                  <StatusDot
                    variant={
                      statusVariant[serverStatuses[url] ?? "disconnected"]
                    }
                    size="xs"
                  />
                  {serverNames[url] ?? shortenUrl(url)}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {service && (
          <Select
            value={pipeline ?? undefined}
            onValueChange={(v) => {
              if (v) setPipeline(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select pipeline..." />
            </SelectTrigger>
            <SelectContent>
              {availablePipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={!service || !pipeline}
            onClick={handleAdd}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
