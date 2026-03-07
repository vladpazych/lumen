import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type SingleProps = {
  multi?: false;
  value: string;
  onPick: () => void;
  onClear: () => void;
  isPicking: boolean;
  thumbnailUri?: string;
  onDropUri?: (uri: string) => void;
};

type MultiProps = {
  multi: true;
  value: string[];
  onChange: (v: string[]) => void;
  onPick: () => void;
  isPicking: boolean;
  thumbnails: Record<string, string>;
  onDropUri?: (uri: string) => void;
  maxItems?: number;
};

type Props = SingleProps | MultiProps;

export function ImageField(props: Props) {
  if (props.multi) {
    return <MultiImageField {...props} />;
  }
  return <SingleImageField {...props} />;
}

function SingleImageField({
  value,
  onPick,
  onClear,
  isPicking,
  thumbnailUri,
  onDropUri,
}: SingleProps) {
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
      <DropZone
        dragOver={dragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-[11px] text-text-tertiary">
          Shift+drag to drop, or
        </span>
        <Button variant="ghost" size="sm" onClick={onPick} disabled={isPicking}>
          {isPicking ? "Uploading..." : "Pick file"}
        </Button>
      </DropZone>
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

function MultiImageField({
  value,
  onChange,
  onPick,
  isPicking,
  thumbnails,
  onDropUri,
  maxItems,
}: MultiProps) {
  const [dragOver, setDragOver] = useState(false);
  const atMax = maxItems != null && value.length >= maxItems;

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.shiftKey || atMax) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    if (!e.shiftKey || atMax) return;
    e.preventDefault();
    setDragOver(false);
    const list = e.dataTransfer.getData("text/uri-list");
    const uri = list
      .split(/\r?\n/)
      .find((u) => u.trim() && !u.startsWith("#"))
      ?.trim();
    if (uri) onDropUri?.(uri);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {value.map((img, i) => {
            const thumb = thumbnails[img];
            const name = img.split("/").pop() ?? img;
            return (
              <div
                key={`${img}-${i}`}
                className="relative group rounded border border-border overflow-hidden"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="w-full h-16 object-cover"
                  />
                ) : (
                  <div className="w-full h-16 flex items-center justify-center bg-surface-1">
                    <span className="text-[9px] text-text-tertiary truncate px-1">
                      {name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute top-0.5 right-0.5 size-4 rounded-sm bg-card/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                >
                  <X className="size-3 text-text-secondary" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!atMax && (
        <DropZone
          dragOver={dragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          compact={value.length > 0}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onPick}
            disabled={isPicking}
          >
            {isPicking ? "Uploading..." : "+ Add image"}
          </Button>
        </DropZone>
      )}
    </div>
  );
}

function DropZone({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  compact,
  children,
}: {
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors ${
        compact ? "p-2" : "p-4"
      } ${
        dragOver
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-border-strong"
      }`}
    >
      {children}
    </div>
  );
}
