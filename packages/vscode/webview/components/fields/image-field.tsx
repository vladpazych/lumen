import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onPick: () => void;
  onClear: () => void;
  isPicking: boolean;
  thumbnailUri?: string;
  onDropUri?: (uri: string) => void;
};

export function ImageField({
  value,
  onPick,
  onClear,
  isPicking,
  thumbnailUri,
  onDropUri,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    setDragOver(false);
    const list = e.dataTransfer.getData("text/uri-list");
    const uri = list
      .split(/\r?\n/)
      .find((u) => u.trim() && !u.startsWith("#"))
      ?.trim();
    if (uri) onDropUri?.(uri);
  };

  const filename = value ? (value.split("/").pop() ?? value) : null;

  if (!filename) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 transition-colors ${
          dragOver
            ? "border-primary/50 bg-primary/5"
            : "border-border hover:border-border-strong"
        }`}
      >
        <span className="text-[11px] text-text-tertiary">
          Shift+drag to drop, or
        </span>
        <Button variant="ghost" size="sm" onClick={onPick} disabled={isPicking}>
          {isPicking ? "Uploading..." : "Pick file"}
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col gap-2">
        {thumbnailUri && (
          <img
            src={thumbnailUri}
            alt=""
            className="max-h-24 max-w-full object-contain rounded border border-border"
          />
        )}
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate min-w-0 text-[11px] text-text-secondary">
            {filename}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isPicking}
          >
            ×
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPick}
            disabled={isPicking}
          >
            Replace
          </Button>
        </div>
      </div>
    </div>
  );
}
