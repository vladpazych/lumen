import { Text } from "../../kit/text"

type Props = { typeName: string }

export function PlaceholderField({ typeName }: Props) {
  return (
    <Text variant="caption" color="tertiary">
      <em>{typeName} input — coming soon</em>
    </Text>
  )
}
