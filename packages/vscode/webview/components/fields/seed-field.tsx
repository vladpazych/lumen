import { useState } from "react";
import { Shuffle } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";

type Props = { value: number | ""; onChange: (v: number) => void; id: string };

export function SeedField({ value, onChange, id }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === "" ? "" : String(value));
  const randomize = () => {
    setDraft(null);
    onChange(Math.floor(Math.random() * 2147483647));
  };

  const commit = (raw: string) => {
    setDraft(null);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) onChange(n);
  };

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type="number"
        min={0}
        step={1}
        placeholder="Random"
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
        }}
      />
      <InputGroupButton onClick={randomize}>
        <Shuffle />
      </InputGroupButton>
    </InputGroup>
  );
}
