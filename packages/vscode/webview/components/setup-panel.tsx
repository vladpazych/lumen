import { useEffect, useMemo, useState } from "react";
import type { PackInfo, ServerSetupInfo } from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  setup: ServerSetupInfo;
  installing: boolean;
  onInstall: (
    serverSetting: string,
    pipelinePackIds: string[],
    skillPackIds: string[],
    initGit: boolean,
  ) => void;
  onRevealServer: () => void;
};

function toggle(items: string[], id: string): string[] {
  return items.includes(id)
    ? items.filter((item) => item !== id)
    : [...items, id].sort();
}

function PackGroup({
  title,
  packs,
  selected,
  onToggle,
}: {
  title: string;
  packs: PackInfo[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (packs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      <div className="flex flex-col gap-2">
        {packs.map((pack) => (
          <label
            key={pack.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2"
          >
            <Checkbox
              checked={selected.includes(pack.id)}
              onCheckedChange={() => onToggle(pack.id)}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-text-primary">{pack.name}</span>
              {pack.description && (
                <span className="text-[11px] text-text-tertiary">
                  {pack.description}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SetupPanel({
  setup,
  installing,
  onInstall,
  onRevealServer,
}: Props) {
  const [serverSetting, setServerSetting] = useState(setup.serverSetting || "server");
  const [initGit, setInitGit] = useState(true);
  const [selectedPipelinePacks, setSelectedPipelinePacks] = useState<string[]>([]);
  const [selectedSkillPacks, setSelectedSkillPacks] = useState<string[]>(["pipeline"]);

  useEffect(() => {
    setServerSetting(setup.serverSetting || "server");
  }, [setup.serverSetting]);

  const availablePipelinePacks = useMemo(
    () => {
      const installed = new Set(setup.manifest?.installedPipelinePacks ?? []);
      return setup.pipelinePacks.filter((pack) => !installed.has(pack.id));
    },
    [setup.manifest?.installedPipelinePacks, setup.pipelinePacks],
  );
  const availableSkillPacks = useMemo(
    () => {
      const installed = new Set(setup.manifest?.installedSkillPacks ?? []);
      return setup.skillPacks.filter((pack) => !installed.has(pack.id));
    },
    [setup.manifest?.installedSkillPacks, setup.skillPacks],
  );

  useEffect(() => {
    setSelectedPipelinePacks((current) =>
      current.filter((id) =>
        availablePipelinePacks.some((pack) => pack.id === id),
      ),
    );
    setSelectedSkillPacks((current) => {
      const next = current.filter((id) =>
        availableSkillPacks.some((pack) => pack.id === id),
      );
      if (next.length > 0) {
        return next;
      }
      return availableSkillPacks.some((pack) => pack.id === "pipeline")
        ? ["pipeline"]
        : [];
    });
  }, [availablePipelinePacks, availableSkillPacks]);

  const handleInstall = () => {
    const nextPipelinePackIds = selectedPipelinePacks.filter((id) =>
      availablePipelinePacks.some((pack) => pack.id === id),
    );
    const nextSkillPackIds = selectedSkillPacks.filter((id) =>
      availableSkillPacks.some((pack) => pack.id === id),
    );

    onInstall(
      serverSetting.trim() || "server",
      nextPipelinePackIds,
      nextSkillPackIds,
      !setup.installed && initGit,
    );
  };

  if (!setup.installed) {
    return (
      <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[13px] text-text-primary">Set Up Your Modal Server</h2>
          <p className="text-[11px] text-text-tertiary">
            Lumen can scaffold a self-contained Modal server, optional starter packs,
            and optional AI skills for this workspace.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="server-path">Server path</Label>
          <Input
            id="server-path"
            value={serverSetting}
            onChange={(event) => setServerSetting(event.target.value)}
            placeholder="server"
          />
        </div>

        <label className="flex items-center gap-2 text-[12px] text-text-primary">
          <Checkbox
            checked={initGit}
            onCheckedChange={(value) => setInitGit(Boolean(value))}
          />
          Initialize git repository
        </label>

        <PackGroup
          title="Starter pipeline packs"
          packs={setup.pipelinePacks}
          selected={selectedPipelinePacks}
          onToggle={(id) =>
            setSelectedPipelinePacks((current) => toggle(current, id))
          }
        />

        <PackGroup
          title="Optional AI skill packs"
          packs={setup.skillPacks}
          selected={selectedSkillPacks}
          onToggle={(id) => setSelectedSkillPacks((current) => toggle(current, id))}
        />

        <Button variant="accent" onClick={handleInstall} disabled={installing}>
          {installing ? "Installing…" : "Install Server"}
        </Button>
      </div>
    );
  }

  if (!setup.managed) {
    return (
      <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-2">
        <h2 className="text-[13px] text-text-primary">External Server Detected</h2>
        <p className="text-[11px] text-text-tertiary">
          Lumen found an existing server at <code>{setup.serverPath}</code>. Start the
          dev server to load pipelines. Pack and skill installation is only available
          for Lumen-managed servers.
        </p>
        <Button variant="outline" size="sm" onClick={onRevealServer}>
          Reveal Folder
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[13px] text-text-primary">Server Ready</h2>
        <p className="text-[11px] text-text-tertiary">
          Managed server at <code>{setup.serverPath}</code>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRevealServer}>
          Reveal Folder
        </Button>
      </div>

      <div className="rounded-md bg-surface-2 px-2.5 py-2 text-[11px] text-text-tertiary">
        Secret name: <span className="text-text-primary">{setup.authSecretName}</span>
      </div>

      <p className="text-[11px] text-text-tertiary">
        Manage Modal credentials and Lumen auth from <code>lumen.config.json</code>.
      </p>

      {(availablePipelinePacks.length > 0 || availableSkillPacks.length > 0) && (
        <>
          <PackGroup
            title="Install more pipeline packs"
            packs={availablePipelinePacks}
            selected={selectedPipelinePacks}
            onToggle={(id) =>
              setSelectedPipelinePacks((current) => toggle(current, id))
            }
          />

          <PackGroup
            title="Install more skill packs"
            packs={availableSkillPacks}
            selected={selectedSkillPacks}
            onToggle={(id) =>
              setSelectedSkillPacks((current) => toggle(current, id))
            }
          />

          <Button
            variant="accent"
            onClick={handleInstall}
            disabled={
              installing ||
              (selectedPipelinePacks.filter((id) =>
                availablePipelinePacks.some((pack) => pack.id === id),
              ).length === 0 &&
                selectedSkillPacks.filter((id) =>
                  availableSkillPacks.some((pack) => pack.id === id),
                ).length === 0)
            }
          >
            {installing ? "Installing…" : "Install Selected Packs"}
          </Button>
        </>
      )}
    </div>
  );
}
