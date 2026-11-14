import type { WebSocketEventHandlers } from '../outbound/websocket.outbound.port.js';

/** Application-facing WebSocket messaging and event registration. */
export interface SocketInboundPort {
  registerEvents(handlers: WebSocketEventHandlers): void;
  broadcast(message: string): Promise<void>;
}
