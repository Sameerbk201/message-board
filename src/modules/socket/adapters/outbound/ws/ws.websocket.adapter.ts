import { randomUUID } from 'node:crypto';

import WebSocket from 'ws';
import type { RawData, WebSocketServer } from 'ws';

import type {
  WebSocketEventHandlers,
  WebSocketOutboundPort,
} from '../../../app/ports/outbound/websocket.outbound.port.js';

export class WsWebSocketAdapter implements WebSocketOutboundPort {
  private readonly server: WebSocketServer;
  private eventsRegistered = false;

  public constructor(server: WebSocketServer) {
    this.server = server;
  }

  public registerEvents(handlers: WebSocketEventHandlers): void {
    if (this.eventsRegistered) {
      throw new Error('WebSocket event handlers are already registered.');
    }
    this.eventsRegistered = true;

    this.server.on('error', (error) => {
      handlers.onError(error);
    });

    const registerConnection = (client: WebSocket): void => {
      const connectionId = randomUUID();
      const reportError = (error: unknown): void => {
        handlers.onError(error, connectionId);
      };

      client.on('error', reportError);
      client.on('message', (data, isBinary) => {
        this.dispatch(
          () => handlers.onMessage(connectionId, this.decodeMessage(data, isBinary)),
          reportError
        );
      });
      client.on('close', (code, reason) => {
        this.dispatch(
          () => handlers.onClose(connectionId, code, reason.toString('utf8')),
          reportError
        );
      });

      this.dispatch(() => handlers.onConnection(connectionId), reportError);
    };

    this.server.on('connection', registerConnection);
    for (const client of this.server.clients) {
      registerConnection(client);
    }
  }

  public async broadcast(message: string): Promise<void> {
    const deliveries: Promise<void>[] = [];

    for (const client of this.server.clients) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      deliveries.push(
        new Promise<void>((resolve, reject) => {
          client.send(message, (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
      );
    }

    await Promise.all(deliveries);
  }

  private decodeMessage(data: RawData, isBinary: boolean): string | Uint8Array {
    let bytes: Buffer;
    if (Array.isArray(data)) {
      bytes = Buffer.concat(data);
    } else if (data instanceof ArrayBuffer) {
      bytes = Buffer.from(data);
    } else {
      bytes = data;
    }

    return isBinary ? bytes : bytes.toString('utf8');
  }

  private dispatch(
    handler: () => void | Promise<void>,
    reportError: (error: unknown) => void
  ): void {
    try {
      void Promise.resolve(handler()).catch(reportError);
    } catch (error) {
      reportError(error);
    }
  }
}
