import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { PipelineConfig } from "@lumen/core/types";

type Props = {
  pipelines: PipelineConfig[];
  onAdd: (pipeline: string) => void;
  onCancel: () => void;
};

export function AddConfigDialog({ pipelines, onAdd, onCancel }: Props) {
  const [pipeline, setPipeline] = useState<string | null>(null);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-col gap-3">
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
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={!pipeline}
            onClick={() => pipeline && onAdd(pipeline)}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
