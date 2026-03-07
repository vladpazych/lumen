import { Inset } from "../kit/inset"
import { Row } from "../kit/row"
import { Text } from "../kit/text"

type Props = {
  imageUrl?: string
  error?: string
  metadata?: Record<string, unknown>
}

function CostBadge({ metadata }: { metadata: Record<string, unknown> }) {
  const parts: string[] = []
  if (metadata.duration_s != null) parts.push(`${metadata.duration_s}s`)
  if (metadata.cost_usd != null) parts.push(`$${metadata.cost_usd}`)
  if (metadata.gpu) parts.push(String(metadata.gpu))
  if (parts.length === 0) return null
  return (
    <Row spacing="snug">
      <Text variant="caption" color="tertiary">
        {parts.join(" · ")}
      </Text>
    </Row>
  )
}

export function ResultDisplay({ imageUrl, error, metadata }: Props) {
  if (error) {
    return (
      <div className="bg-surface-2 rounded-md">
        <Inset spacing="snug">
          <Text variant="caption" color="destructive">
            {error}
          </Text>
        </Inset>
      </div>
    )
  }
  if (imageUrl) {
    return (
      <div>
        <img src={imageUrl} alt="Generated" className="w-full rounded-md" />
        {metadata && <CostBadge metadata={metadata} />}
      </div>
    )
  }
  return null
}
