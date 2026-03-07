type Props = { typeName: string };

export function PlaceholderField({ typeName }: Props) {
  return (
    <p className="text-[11px] text-text-tertiary italic">
      {typeName} input — coming soon
    </p>
  );
}
