import { Label } from "@/components/ui/label";
import type { PipelineConfig } from "@lumen/core/types";
import { ParamField } from "@/components/param-field";

type Props = {
  pipeline: PipelineConfig;
  values: Record<string, unknown>;
  onParamChange: (paramName: string, value: unknown) => void;
  onPickImage: (paramName: string) => void;
  isPickingImage: boolean;
  imageThumbs: Record<string, string>;
  onPickImageByUri: (paramName: string, uri: string) => void;
};

export function PipelineForm({
  pipeline,
  values,
  onParamChange,
  onPickImage,
  isPickingImage,
  imageThumbs,
  onPickImageByUri,
}: Props) {
  const groups = new Map<string, typeof pipeline.params>();
  for (const param of pipeline.params) {
    if (param.name === "quality") continue;
    const group = param.group ?? "";
    const existing = groups.get(group) ?? [];
    existing.push(param);
    groups.set(group, existing);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([group, params]) => (
        <div key={group} className="flex flex-col gap-3">
          {group && (
            <div className="border-b border-border pb-1">
              <Label>{group}</Label>
            </div>
          )}
          {params.map((param) => {
            const imgValue =
              param.type === "image"
                ? (values[param.name] as string | undefined)
                : undefined;
            return (
              <ParamField
                key={param.name}
                param={param}
                value={values[param.name]}
                onChange={(v) => onParamChange(param.name, v)}
                onPickImage={
                  param.type === "image"
                    ? () => onPickImage(param.name)
                    : undefined
                }
                isPicking={param.type === "image" ? isPickingImage : undefined}
                thumbnailUri={imgValue ? imageThumbs[imgValue] : undefined}
                onDropUri={
                  param.type === "image"
                    ? (uri) => onPickImageByUri(param.name, uri)
                    : undefined
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
