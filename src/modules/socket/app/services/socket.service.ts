import type { SocketInboundPort } from '../ports/inbound/socket.inbound.port.js';
import type {
  WebSocketEventHandlers,
  WebSocketOutboundPort,
} from '../ports/outbound/websocket.outbound.port.js';

export interface SocketServiceDeps {
  readonly socket: WebSocketOutboundPort;
}

export class SocketService implements SocketInboundPort {
  private readonly socket: WebSocketOutboundPort;

  public constructor(deps: SocketServiceDeps) {
    this.socket = deps.socket;
  }

  public registerEvents(handlers: WebSocketEventHandlers): void {
    this.socket.registerEvents(handlers);
  }

  public broadcast(message: string): Promise<void> {
    return this.socket.broadcast(message);
  }
}
