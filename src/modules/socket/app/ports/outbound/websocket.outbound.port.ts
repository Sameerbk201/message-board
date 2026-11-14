/** Application callbacks for WebSocket lifecycle and incoming messages. */
export interface WebSocketEventHandlers {
  onConnection(connectionId: string): void | Promise<void>;
  /** Text frames are strings; binary frames are bytes. Validate payloads before use. */
  onMessage(connectionId: string, message: string | Uint8Array): void | Promise<void>;
  onClose(connectionId: string, code: number, reason: string): void | Promise<void>;
  /** Receives transport and callback errors; must be synchronous and must not throw. */
  onError(error: unknown, connectionId?: string): void;
}

/** Send application messages and register WebSocket lifecycle callbacks. */
export interface WebSocketOutboundPort {
  /** Register once for new and already connected clients. */
  registerEvents(handlers: WebSocketEventHandlers): void;

  /** Write to all open clients; completion does not acknowledge client receipt. */
  broadcast(message: string): Promise<void>;
}
