import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import type { PipelineConfig } from "@vladpazych/lumen/types";

type Props = {
  pipelines: PipelineConfig[];
  onAdd: (pipeline: string) => void;
  onCancel: () => void;
};

export function AddConfigDialog({ pipelines, onAdd, onCancel }: Props) {
  const [pipeline, setPipeline] = useState<string | null>(null);

  const options = pipelines.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-col gap-3">
        <Combobox
          options={options}
          value={pipeline ?? ""}
          onValueChange={setPipeline}
          placeholder="Select pipeline..."
        />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" grow onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            grow
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
