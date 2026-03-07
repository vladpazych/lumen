declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void
  getState<T>(): T | undefined
  setState<T>(state: T): T
}

export const vscode = acquireVsCodeApi()
