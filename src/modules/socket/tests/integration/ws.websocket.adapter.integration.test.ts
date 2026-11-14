import { EventEmitter, once } from 'node:events';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';

import { WsWebSocketAdapter } from '../../adapters/outbound/ws/ws.websocket.adapter.js';
import type {
  WebSocketEventHandlers,
  WebSocketOutboundPort,
} from '../../app/ports/outbound/websocket.outbound.port.js';

describe('WsWebSocketAdapter', () => {
  let server: WebSocketServer;
  let adapter: WebSocketOutboundPort;
  const clients: WebSocket[] = [];

  beforeEach(async () => {
    server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    adapter = new WsWebSocketAdapter(server);
  });

  afterEach(async () => {
    for (const client of clients) {
      client.terminate();
    }
    clients.length = 0;

    for (const client of server.clients) {
      client.terminate();
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  async function connectClient(): Promise<WebSocket> {
    const address = server.address();
    if (typeof address === 'string' || address === null) {
      throw new Error('Expected the WebSocket server to have a TCP address.');
    }

    const client = new WebSocket(`ws://127.0.0.1:${String(address.port)}`);
    clients.push(client);
    await once(client, 'open');
    return client;
  }

  it('completes when no clients are connected', async () => {
    await expect(adapter.broadcast('hello')).resolves.toBeUndefined();
  });

  it('sends the same text message to every connected client', async () => {
    const first = await connectClient();
    const second = await connectClient();
    const firstMessage = once(first, 'message');
    const secondMessage = once(second, 'message');
    const message = 'Hello, message board! 👋';

    await adapter.broadcast(message);

    for (const received of [firstMessage, secondMessage]) {
      const [data, isBinary] = await received;
      expect(data).toEqual(Buffer.from(message));
      expect(isBinary).toBe(false);
    }
  });

  it('skips a closing client and still sends to an open client', async () => {
    await connectClient();
    const openClient = await connectClient();
    const closingClient = [...server.clients][0];
    if (!closingClient) {
      throw new Error('Expected a connected client.');
    }

    closingClient.close();
    expect(closingClient.readyState).toBe(WebSocket.CLOSING);
    const received = once(openClient, 'message');

    await adapter.broadcast('still connected');

    const [data] = await received;
    expect(data).toEqual(Buffer.from('still connected'));
  });

  it('preserves an empty text message', async () => {
    const client = await connectClient();
    const received = once(client, 'message');

    await adapter.broadcast('');

    const [data, isBinary] = await received;
    expect(data).toEqual(Buffer.alloc(0));
    expect(isBinary).toBe(false);
  });

  function createEventHandlers(events: EventEmitter): WebSocketEventHandlers {
    return {
      onConnection(connectionId) {
        events.emit('connected', connectionId);
      },
      onMessage(connectionId, message) {
        events.emit('received', connectionId, message);
      },
      onClose(connectionId, code, reason) {
        events.emit('disconnected', connectionId, code, reason);
      },
      onError(error, connectionId) {
        events.emit('socket-error', error, connectionId);
      },
    };
  }

  it('registers new connections with distinct IDs and keeps clients tracked', async () => {
    const events = new EventEmitter();
    adapter.registerEvents(createEventHandlers(events));
    const firstConnected = once(events, 'connected');
    await connectClient();
    const [firstId] = await firstConnected;
    const secondConnected = once(events, 'connected');
    await connectClient();
    const [secondId] = await secondConnected;

    expect(firstId).toEqual(expect.any(String));
    expect(secondId).toEqual(expect.any(String));
    expect(firstId).not.toBe(secondId);
    expect(server.clients.size).toBe(2);
  });

  it('forwards text messages with the same connection ID', async () => {
    const events = new EventEmitter();
    adapter.registerEvents(createEventHandlers(events));
    const connected = once(events, 'connected');
    const client = await connectClient();
    const [connectionId] = await connected;
    const received = once(events, 'received');

    client.send('Hello 👋');

    await expect(received).resolves.toEqual([connectionId, 'Hello 👋']);
  });

  it.each(['nodebuffer', 'arraybuffer', 'fragments'] as const)(
    'forwards binary messages as bytes with %s payloads',
    async (binaryType) => {
      const events = new EventEmitter();
      adapter.registerEvents(createEventHandlers(events));
      const connected = once(events, 'connected');
      const client = await connectClient();
      const [connectionId] = await connected;
      const serverClient = [...server.clients][0];
      if (!serverClient) {
        throw new Error('Expected a connected client.');
      }
      serverClient.binaryType = binaryType;
      const received = once(events, 'received');
      const payload = Buffer.from([0, 255, 128, 65]);

      client.send(payload);

      const [receivedId, message] = await received;
      expect(receivedId).toBe(connectionId);
      expect(message).toBeInstanceOf(Uint8Array);
      expect(message).toEqual(payload);
    }
  );

  it('forwards close details and lets the server remove disconnected clients', async () => {
    const events = new EventEmitter();
    adapter.registerEvents(createEventHandlers(events));
    const connected = once(events, 'connected');
    const client = await connectClient();
    const [connectionId] = await connected;
    const disconnected = once(events, 'disconnected');

    client.close(1000, 'finished');

    await expect(disconnected).resolves.toEqual([connectionId, 1000, 'finished']);
    expect(server.clients.size).toBe(0);
  });

  it('registers callbacks for clients that are already connected', async () => {
    const client = await connectClient();
    const events = new EventEmitter();
    const connected = once(events, 'connected');

    adapter.registerEvents(createEventHandlers(events));

    const [connectionId] = await connected;
    const received = once(events, 'received');
    client.send('already connected');
    await expect(received).resolves.toEqual([connectionId, 'already connected']);
  });

  it('rejects duplicate registration without adding another connection listener', () => {
    const events = new EventEmitter();
    const handlers = createEventHandlers(events);
    adapter.registerEvents(handlers);
    const listenerCount = server.listenerCount('connection');

    expect(() => {
      adapter.registerEvents(handlers);
    }).toThrow('already registered');
    expect(server.listenerCount('connection')).toBe(listenerCount);
  });

  it('forwards real socket protocol errors with the connection ID', async () => {
    const events = new EventEmitter();
    adapter.registerEvents(createEventHandlers(events));
    const connected = once(events, 'connected');
    const client = await connectClient();
    const [connectionId] = await connected;
    const socketError = once(events, 'socket-error');

    client.send(Buffer.from([0xc3, 0x28]), { binary: false });

    const [error, errorConnectionId] = await socketError;
    expect(error).toBeInstanceOf(Error);
    expect(errorConnectionId).toBe(connectionId);
  });

  it.each(['synchronous', 'asynchronous'] as const)(
    'reports a failing %s message handler through onError',
    async (mode) => {
      const events = new EventEmitter();
      const failure = new Error('Message handling failed.');
      const onMessage =
        mode === 'synchronous'
          ? (): void => {
              throw failure;
            }
          : (): Promise<void> => Promise.reject(failure);
      adapter.registerEvents({ ...createEventHandlers(events), onMessage });
      const connected = once(events, 'connected');
      const client = await connectClient();
      const [connectionId] = await connected;
      const socketError = once(events, 'socket-error');

      client.send('trigger handler');

      await expect(socketError).resolves.toEqual([failure, connectionId]);
    }
  );

  it('forwards server errors without a connection ID', async () => {
    const address = server.address();
    if (typeof address === 'string' || address === null) {
      throw new Error('Expected the WebSocket server to have a TCP address.');
    }
    const events = new EventEmitter();
    const serverError = once(events, 'socket-error');
    const conflictingServer = new WebSocketServer({
      host: '127.0.0.1',
      port: address.port,
    });
    const conflictingAdapter = new WsWebSocketAdapter(conflictingServer);

    try {
      conflictingAdapter.registerEvents(createEventHandlers(events));
      const [error, connectionId] = await serverError;
      expect(error).toMatchObject({ code: 'EADDRINUSE' });
      expect(connectionId).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => {
        conflictingServer.close(() => {
          resolve();
        });
      });
    }
  });
});
