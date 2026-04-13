import type { WebSocket } from "ws";

export type WSData = { target: string | null; previewTargets: Set<string>; mode?: "pty" };
export type MawWS = WebSocket & { data: WSData; send: (data: string | Buffer) => void };

// Use a generic engine type to avoid circular dependency
export interface MawEngineLike {
  on(event: string, handler: Function): void;
  pushCapture?(ws: any): void;
  pushPreviews?(ws: any): void;
}
export type Handler = (ws: MawWS, data: any, engine: MawEngineLike) => void | Promise<void>;
