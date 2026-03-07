import { useState } from "react";
import { Stack } from "../kit/stack";
import { Row } from "../kit/row";
import { Inset } from "../kit/inset";
import { StatusDot } from "../kit/status-dot";
import { Button } from "../kit/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../kit/select";
import type { PipelineConfig, ServerStatus } from "../../shared/types";

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

export function AddConfig({
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
    <div className="border border-border rounded-md">
      <Inset spacing="normal">
        <Stack spacing="normal">
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
                  <Row spacing="snug" align="center">
                    <StatusDot
                      variant={
                        statusVariant[serverStatuses[url] ?? "disconnected"]
                      }
                      size="xs"
                    />
                    {serverNames[url] ?? shortenUrl(url)}
                  </Row>
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

          <Row spacing="snug" justify="end">
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
          </Row>
        </Stack>
      </Inset>
    </div>
  );
}
