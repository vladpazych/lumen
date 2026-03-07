import { Row } from "../kit/row"
import { Button } from "../kit/button"
import type { DevServerState } from "../../shared/types"

type Props = {
  devServerUrl: string | null
  devServerState: DevServerState
  onStartServer: () => void
  onStopServer: () => void
  onAddConfig: () => void
}

export function Header({ devServerUrl, devServerState, onStartServer, onStopServer, onAddConfig }: Props) {
  const canStart = devServerState === "stopped" || devServerState === "error"
  const canStop = devServerState === "running" || devServerState === "starting"
  const showDevControls = devServerUrl !== null

  return (
    <Row justify="between" align="center">
      <Button variant="outline" size="sm" onClick={onAddConfig}>
        + Add
      </Button>
      {showDevControls && (
        <Row spacing="snug" align="center">
          {canStart && (
            <Button variant="ghost" size="xs" onClick={onStartServer}>
              Start
            </Button>
          )}
          {canStop && (
            <Button variant="ghost" size="xs" onClick={onStopServer}>
              {devServerState === "starting" ? "Starting..." : "Stop"}
            </Button>
          )}
        </Row>
      )}
    </Row>
  )
}
