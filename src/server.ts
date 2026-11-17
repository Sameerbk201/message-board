import { createServer } from 'node:https';
import type { Server as HttpsServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { isSea } from 'node:sea';
import { pathToFileURL } from 'node:url';

import pino from 'pino';
import WebSocket, { WebSocketServer } from 'ws';

import { createApp } from './app.js';
import { ensureSelfSignedTls } from './modules/application/infra/configs/self-signed.tls.js';
import { createSocketToolkit } from './modules/socket/infra/di/socket.di.js';
import type { SocketToolkit } from './modules/socket/infra/di/socket.di.js';

const logger = pino({ name: 'message-board' });

export interface StartServerOptions {
  /** Port 0 requests an available port from the operating system. */
  readonly port?: number;
}

export interface ServerInstance {
  readonly httpServer: HttpsServer;
  readonly wsServer: WebSocketServer;
  readonly socketToolkit: SocketToolkit;
  stop(): Promise<void>;
}

/** Prepare development TLS and own the shared HTTPS/WebSocket listener. */
export async function startServer(options: StartServerOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? Number(process.env.PORT ?? 8887);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }

  const httpServer = createServer(await ensureSelfSignedTls(), createApp());
  const wsServer = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  });
  const maxFileBytes = 10 * 1024 * 1024;
  const fileServer = new WebSocketServer({ noServer: true, maxPayload: maxFileBytes + 257 });

  httpServer.on('upgrade', (request, socket, head) => {
    const path = request.url?.split('?')[0];
    let target: WebSocketServer | undefined;
    if (path === '/api/message-board') target = wsServer;
    if (path === '/api/message-board/files') target = fileServer;
    if (!target) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    target.handleUpgrade(request, socket, head, (client) => {
      target.emit('connection', client, request);
    });
  });

  fileServer.on('connection', (client) => {
    client.on('error', (error) => {
      logger.error({ err: error }, 'File WebSocket error');
    });
    client.on('message', (data, isBinary) => {
      if (!isBinary || !Buffer.isBuffer(data) || data.length < 3) {
        client.close(1008, 'Invalid file');
        return;
      }
      const nameLength = data.readUInt16BE(0);
      const fileSize = data.length - 2 - nameLength;
      if (nameLength === 0 || nameLength > 255 || fileSize < 0 || fileSize > maxFileBytes) {
        client.close(1008, 'Invalid file');
        return;
      }
      for (const recipient of fileServer.clients) {
        if (recipient.readyState !== WebSocket.OPEN) continue;
        if (recipient.bufferedAmount + data.length > 2 * (maxFileBytes + 257)) {
          recipient.terminate();
          continue;
        }
        recipient.send(data, { binary: true }, (error) => {
          if (error) logger.error({ err: error }, 'File delivery failed');
        });
      }
    });
  });
  fileServer.on('error', (error) => {
    logger.error({ err: error }, 'File WebSocket server error');
  });
  const socketToolkit = createSocketToolkit({ server: wsServer });

  socketToolkit.service.registerEvents({
    onConnection(connectionId) {
      logger.info({ connectionId }, 'WebSocket connected');
    },
    onMessage(_connectionId, message) {
      if (typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Message must be non-empty text.');
      }

      return socketToolkit.service.broadcast(message);
    },
    onClose(connectionId, code) {
      logger.info({ connectionId, code }, 'WebSocket disconnected');
    },
    onError(error, connectionId) {
      logger.error({ err: error, connectionId }, 'WebSocket error');
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        httpServer.off('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        httpServer.off('error', onError);
        resolve();
      };

      httpServer.once('error', onError);
      httpServer.once('listening', onListening);
      httpServer.listen(port, '0.0.0.0');
    });
  } catch (error) {
    await Promise.all(
      [wsServer, fileServer].map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => {
              resolve();
            });
          })
      )
    );
    throw error;
  }

  const address = httpServer.address();
  logger.info({ host: '0.0.0.0', address }, 'Message board listening');

  try {
    if (address !== null && typeof address !== 'string') {
      for (const [interfaceName, addresses] of Object.entries(networkInterfaces())) {
        for (const info of addresses ?? []) {
          if (info.family === 'IPv4' && !info.internal) {
            logger.info(
              {
                interface: interfaceName,
                ipv4: info.address,
                url: `https://${info.address}:${String(address.port)}/api/message-board`,
              },
              'Message board IPv4 address'
            );
          }
        }
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'Unable to list IPv4 network addresses');
  }

  let shutdown: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    if (!shutdown) {
      for (const server of [wsServer, fileServer]) {
        for (const client of server.clients) client.terminate();
      }

      shutdown = Promise.all([
        new Promise<void>((resolve, reject) => {
          wsServer.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
        new Promise<void>((resolve, reject) => {
          fileServer.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
        new Promise<void>((resolve, reject) => {
          httpServer.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
      ]).then(() => undefined);
    }

    return shutdown;
  };

  return { httpServer, wsServer, socketToolkit, stop };
}

const entrypoint = process.argv[1];
if (isSea() || (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href)) {
  const portArgument = process.argv[2];
  void startServer(portArgument === undefined ? {} : { port: Number(portArgument) }).then(
    (instance) => {
      const shutdown = (): void => {
        void instance.stop().catch((error: unknown) => {
          logger.error({ err: error }, 'Server shutdown failed');
          process.exitCode = 1;
        });
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    },
    (error: unknown) => {
      logger.error({ err: error }, 'Server startup failed');
      process.exitCode = 1;
    }
  );
}
