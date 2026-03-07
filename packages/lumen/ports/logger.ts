/** Driven port — structured logging */
export type LoggerPort = {
  info(message: string): void;
  error(message: string): void;
};
