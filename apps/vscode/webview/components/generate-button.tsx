import { useEffect, useState } from "react"
import { Button } from "../kit/button"
import { Row } from "../kit/row"

type Props = {
  loading: boolean
  progress?: number
  hasQuality?: boolean
  onPreview?: () => void
  onGenerate: () => void
}

function formatStatus(elapsed: number, progress?: number): string {
  if (progress && progress > 0) {
    const pct = Math.round(progress * 100)
    return `${pct}% · ${elapsed}s`
  }
  return `${elapsed}s`
}

export function GenerateButton({ loading, progress, hasQuality, onPreview, onGenerate }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!loading) {
      setElapsed(0)
      return
    }
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [loading])

  if (hasQuality && onPreview) {
    const status = formatStatus(elapsed, progress)
    return (
      <Row spacing="snug">
        <Button variant="outline" grow disabled={loading} onClick={onPreview}>
          {loading ? status : "Preview"}
        </Button>
        <Button variant="accent" grow disabled={loading} onClick={onGenerate}>
          {loading ? status : "Generate"}
        </Button>
      </Row>
    )
  }

  return (
    <Button variant="accent" grow disabled={loading} onClick={onGenerate}>
      {loading ? `Generating... ${formatStatus(elapsed, progress)}` : "Generate"}
    </Button>
  )
}
