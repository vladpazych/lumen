import { useId } from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ParamDefinition } from "@lumen/core/types";
import { BooleanField } from "@/components/fields/boolean-field";
import { DimensionsField } from "@/components/fields/dimensions-field";
import { IntegerField } from "@/components/fields/integer-field";
import { NumberField } from "@/components/fields/number-field";
import { ImageField } from "@/components/fields/image-field";
import { VideoField } from "@/components/fields/video-field";
import { PromptField } from "@/components/fields/prompt-field";
import { SeedField } from "@/components/fields/seed-field";
import { SelectField } from "@/components/fields/select-field";
import { TagsField } from "@/components/fields/tags-field";
import { TextField } from "@/components/fields/text-field";

type Props = {
  param: ParamDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onPickImage?: () => void;
  isPicking?: boolean;
  thumbnailUri?: string;
  imageThumbs?: Record<string, string>;
  onDropUri?: (uri: string) => void;
};

export function ParamField({
  param,
  value,
  onChange,
  onPickImage,
  isPicking,
  thumbnailUri,
  imageThumbs,
  onDropUri,
}: Props) {
  if (param.hidden) return null;

  const fieldId = useId();
  const showLabel = param.type !== "boolean";
  const label = param.label ?? param.name;

  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <div className="flex items-center gap-1">
          <Label htmlFor={fieldId}>{label}</Label>
          {param.description && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="size-3 text-text-tertiary" />
              </TooltipTrigger>
              <TooltipContent>{param.description}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      {renderField(
        param,
        value,
        onChange,
        fieldId,
        onPickImage,
        isPicking,
        thumbnailUri,
        imageThumbs,
        onDropUri,
      )}
    </div>
  );
}

function renderField(
  param: ParamDefinition,
  value: unknown,
  onChange: (v: unknown) => void,
  id: string,
  onPickImage?: () => void,
  isPicking?: boolean,
  thumbnailUri?: string,
  imageThumbs?: Record<string, string>,
  onDropUri?: (uri: string) => void,
) {
  switch (param.type) {
    case "prompt":
      return (
        <PromptField
          param={param}
          value={(value as string) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
    case "text":
      return (
        <TextField
          param={param}
          value={(value as string) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
    case "number":
      return (
        <NumberField
          param={param}
          value={(value as number) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
    case "integer":
      return (
        <IntegerField
          param={param}
          value={(value as number) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
    case "boolean":
      return (
        <BooleanField
          param={param}
          value={(value as boolean) ?? param.default ?? false}
          onChange={onChange}
          id={id}
        />
      );
    case "select":
      return (
        <SelectField
          param={param}
          value={(value as string) ?? param.default ?? ""}
          onChange={onChange}
          id={id}
        />
      );
    case "seed":
      return (
        <SeedField
          value={(value as number) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
    case "dimensions":
      return (
        <DimensionsField
          param={param}
          value={(value as { w: number; h: number }) ?? null}
          onChange={onChange}
        />
      );
    case "image": {
      const isMulti = (param.maxItems ?? 1) > 1;
      if (isMulti) {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        return (
          <ImageField
            multi
            value={arr}
            onChange={onChange}
            onPick={onPickImage ?? (() => {})}
            isPicking={isPicking ?? false}
            thumbnails={imageThumbs ?? {}}
            onDropUri={
              onDropUri
                ? (uri) => {
                    onChange([...arr, uri]);
                  }
                : undefined
            }
            maxItems={param.maxItems}
          />
        );
      }
      return (
        <ImageField
          value={(value as string) ?? ""}
          onPick={onPickImage ?? (() => {})}
          onClear={() => onChange("")}
          isPicking={isPicking ?? false}
          thumbnailUri={thumbnailUri}
          onDropUri={onDropUri}
        />
      );
    }
    case "video":
      return (
        <VideoField
          value={(value as string) ?? ""}
          onPick={onPickImage ?? (() => {})}
          onClear={() => onChange("")}
          isPicking={isPicking ?? false}
          onDropUri={onDropUri}
        />
      );
    case "tags":
      return (
        <TagsField
          param={param}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          id={id}
        />
      );
  }
}
