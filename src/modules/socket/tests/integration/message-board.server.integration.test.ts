import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { startServer } from '../../../../server.js';
import type { ServerInstance } from '../../../../server.js';
import { SELF_SIGNED_TLS_DIRECTORY } from '../../../application/infra/configs/self-signed.tls.js';

describe('Message Board server', () => {
  let instance: ServerInstance;
  let httpsUrl: string;
  let certificate: string;
  let socketUrl: string;
  const clients: WebSocket[] = [];

  beforeEach(async () => {
    instance = await startServer({ port: 0 });
    const address = instance.httpServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected the HTTP server to have a TCP address.');
    }
    certificate = await readFile(join(SELF_SIGNED_TLS_DIRECTORY, 'server.crt'), 'utf8');
    httpsUrl = `https://127.0.0.1:${String(address.port)}`;
    socketUrl = `wss://127.0.0.1:${String(address.port)}/api/message-board`;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.terminate();
    }
    clients.length = 0;
    await instance.stop();
  });

  async function connectClient(url = socketUrl): Promise<WebSocket> {
    const client = new WebSocket(url, { ca: certificate });
    clients.push(client);
    await once(client, 'open');
    return client;
  }

  it('binds the shared HTTPS/WebSocket listener to all IPv4 interfaces', () => {
    expect(instance.httpServer.address()).toMatchObject({ address: '0.0.0.0' });
  });

  it('requires clients to explicitly trust the self-signed certificate', async () => {
    await expect(fetch(httpsUrl + '/api/message-board')).rejects.toThrow();
  });

  it('serves the message-sharing interface for GET /api/message-board', async () => {
    const response = await request(httpsUrl).get('/api/message-board').ca(certificate);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-store');
    const page = response.text;
    expect(page).toContain('<title>Message Board</title>');
    expect(page).toContain('id="message-form"');
    expect(page).toContain('role="log"');
  });

  it.each(['/', '/message-board', '/missing', '/api/message-board/child'])(
    'returns 404 for %s',
    async (path) => {
      const response = await request(httpsUrl).get(path).ca(certificate);

      expect(response.status).toBe(404);
      expect(response.text).toBe('404 not found');
    }
  );

  it.each(['post', 'put', 'delete'] as const)('returns 404 for %s requests', async (method) => {
    const response = await request(httpsUrl)[method]('/api/message-board').ca(certificate);

    expect(response.status).toBe(404);
    expect(response.text).toBe('404 not found');
  });

  it('broadcasts a message through the socket service and toolkit to every client', async () => {
    const sender = await connectClient();
    const receiver = await connectClient();
    const senderMessage = once(sender, 'message');
    const receiverMessage = once(receiver, 'message');
    const message = 'Hello from the network! 👋';

    sender.send(message);

    const [senderData] = await senderMessage;
    const [receiverData] = await receiverMessage;
    expect(senderData).toEqual(Buffer.from(message));
    expect(receiverData).toEqual(Buffer.from(message));
  });

  it('starts newly connected clients without replaying previous messages', async () => {
    const sender = await connectClient();
    const oldMessage = once(sender, 'message');
    sender.send('previous session message');
    await oldMessage;

    const newcomer = new WebSocket(socketUrl, { ca: certificate });
    clients.push(newcomer);
    const received: unknown[] = [];
    newcomer.on('message', (data) => {
      received.push(data);
    });
    await once(newcomer, 'open');
    const freshMessage = once(newcomer, 'message');

    sender.send('new live message');
    await freshMessage;

    expect(received).toEqual([Buffer.from('new live message')]);
  });

  it('rejects blank and binary messages while continuing to broadcast valid text', async () => {
    const sender = await connectClient();
    const receiver = await connectClient();
    const received = once(receiver, 'message');

    sender.send('   ');
    sender.send(Buffer.from('binary'));
    sender.send('valid text');

    const [data] = await received;
    expect(data).toEqual(Buffer.from('valid text'));
  });

  it.each([
    ['ASCII', 'x'.repeat(64 * 1024)],
    ['Unicode', '👋'.repeat(16 * 1024)],
  ])('broadcasts a full 64 KiB %s message without truncation', async (_label, message) => {
    const sender = await connectClient();
    const receiver = await connectClient();
    const received = once(receiver, 'message');

    expect(Buffer.byteLength(message, 'utf8')).toBe(64 * 1024);
    sender.send(message);

    const [data] = await received;
    expect(data).toEqual(Buffer.from(message));
  });

  it('enforces the byte limit for multi-byte Unicode messages', async () => {
    const client = await connectClient();
    const closed = once(client, 'close');

    client.send('👋'.repeat(16 * 1024 + 1));

    const [code] = await closed;
    expect(code).toBe(1009);
  });

  it('closes connections that send messages larger than 64 KiB', async () => {
    const client = await connectClient();
    const closed = once(client, 'close');

    client.send('x'.repeat(64 * 1024 + 1));

    const [code] = await closed;
    expect(code).toBe(1009);
  });

  it('rejects WebSocket upgrades outside /api/message-board', async () => {
    await expect(connectClient(socketUrl + '/missing')).rejects.toThrow(
      'Unexpected server response'
    );
  });

  it('stops both servers and permits repeated shutdown calls', async () => {
    const client = await connectClient();
    const closed = once(client, 'close');

    await instance.stop();
    await closed;

    expect(instance.httpServer.listening).toBe(false);
    await expect(instance.stop()).resolves.toBeUndefined();
  });

  it.each([-1, 1.5, 65536, NaN])('rejects invalid listening port %s', async (port) => {
    await expect(startServer({ port })).rejects.toThrow(
      'PORT must be an integer between 0 and 65535'
    );
  });

  it('cleans up a failed startup without disturbing the existing server', async () => {
    const address = instance.httpServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected the HTTP server to have a TCP address.');
    }

    await expect(startServer({ port: address.port })).rejects.toMatchObject({
      code: 'EADDRINUSE',
    });
    const response = await request(httpsUrl).get('/api/message-board').ca(certificate);
    expect(response.text).toContain('<title>Message Board</title>');
  });
});
