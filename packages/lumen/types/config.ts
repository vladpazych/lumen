/** A single config entry in the .lumen file — identified by stable UUID */
export type LumenConfig = {
  id: string;
  name?: string;
  service: string;
  pipeline: string;
  params: Record<string, unknown>;
};

export type ServerConfig = {
  name: string;
  url?: string;
  source?: string;
};

export type ServerStatus = "connected" | "disconnected" | "error";
