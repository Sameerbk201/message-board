import type { WebSocketServer } from 'ws';

import { WsWebSocketAdapter } from '../../adapters/outbound/ws/ws.websocket.adapter.js';
import type { SocketInboundPort } from '../../app/ports/inbound/socket.inbound.port.js';
import type { WebSocketOutboundPort } from '../../app/ports/outbound/websocket.outbound.port.js';
import { SocketService } from '../../app/services/socket.service.js';

export interface SocketToolkitDeps {
  /** Server lifecycle belongs to the process entrypoint. */
  readonly server: WebSocketServer;
}

export interface SocketToolkit {
  readonly adapter: WebSocketOutboundPort;
  readonly service: SocketInboundPort;
}

/** Compose one socket adapter and application service over the supplied server. */
export function createSocketToolkit(deps: SocketToolkitDeps): SocketToolkit {
  const adapter = new WsWebSocketAdapter(deps.server);

  return {
    adapter,
    service: new SocketService({ socket: adapter }),
  };
}
