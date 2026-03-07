import { Row } from "../../kit/row"
import { Stack } from "../../kit/stack"
import { Button } from "../../kit/button"
import { Text } from "../../kit/text"

type Props = {
  value: string
  onPick: () => void
  onClear: () => void
  isPicking: boolean
  thumbnailUri?: string
  onDropUri?: (uri: string) => void
}

export function ImageField({ value, onPick, onClear, isPicking, thumbnailUri, onDropUri }: Props) {
  const handleDragOver = (e: React.DragEvent) => {
    if (!e.shiftKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!e.shiftKey) return
    e.preventDefault()
    const list = e.dataTransfer.getData("text/uri-list")
    const uri = list
      .split(/\r?\n/)
      .find((u) => u.trim() && !u.startsWith("#"))
      ?.trim()
    if (uri) onDropUri?.(uri)
  }

  const filename = value ? (value.split("/").pop() ?? value) : null

  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop}>
      <Stack spacing="tight">
        {thumbnailUri && (
          <img src={thumbnailUri} alt="" className="max-h-24 max-w-full object-contain rounded border border-border" />
        )}
        {filename ? (
          <Row spacing="snug">
            <Text variant="caption" color="secondary" className="flex-1 truncate min-w-0">
              {filename}
            </Text>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={isPicking}>
              ×
            </Button>
            <Button variant="ghost" size="sm" onClick={onPick} disabled={isPicking}>
              Replace
            </Button>
          </Row>
        ) : (
          <Button variant="ghost" size="sm" onClick={onPick} disabled={isPicking}>
            {isPicking ? "Uploading…" : "Pick file"}
          </Button>
        )}
      </Stack>
    </div>
  )
}
