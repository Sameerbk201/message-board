import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import https from 'node:https';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import WebSocket from 'ws';

const executable = process.argv[2];
if (!executable) throw new Error('Pass the path to the extracted executable.');

const child = spawn(resolve(executable), [], {
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const clients: WebSocket[] = [];
let output = '';
child.stderr.on('data', (chunk: Buffer) => {
  output += chunk.toString();
});

try {
  const port = await new Promise<number>((resolvePort, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timed out.'));
    }, 30000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Server exited before startup.'));
    });
    let lines = '';
    child.stdout.on('data', (chunk: Buffer) => {
      lines += chunk.toString();
      output += chunk.toString();
      const records = lines.split('\n');
      lines = records.pop() ?? '';
      for (const line of records) {
        try {
          const record = JSON.parse(line) as { msg?: string; address?: { port?: number } };
          if (
            record.msg === 'Message board listening' &&
            typeof record.address?.port === 'number'
          ) {
            clearTimeout(timeout);
            resolvePort(record.address.port);
          }
        } catch {
          // Ignore any non-JSON diagnostic output.
        }
      }
    });
  });
  const ca = await readFile(join(homedir(), '.message-board', 'tls', 'server.crt'));
  const base = `127.0.0.1:${String(port)}`;
  const page = await new Promise<{ status: number | undefined; body: string }>(
    (resolvePage, reject) => {
      https
        .get(
          `https://${base}/api/message-board`,
          { ca, signal: AbortSignal.timeout(10000) },
          (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => {
              body += chunk;
            });
            response.on('end', () => {
              resolvePage({ status: response.statusCode, body });
            });
            response.on('error', reject);
          }
        )
        .on('error', reject);
    }
  );
  assert.equal(page.status, 200);
  assert.match(page.body, /Shared files/);

  for (const [path, payload] of [
    ['/api/message-board', 'release smoke test'],
    ['/api/message-board/files', Buffer.from([0, 1, 65, 42])],
  ] as const) {
    const sender = new WebSocket(`wss://${base}${path}`, { ca });
    const recipient = new WebSocket(`wss://${base}${path}`, { ca });
    clients.push(sender, recipient);
    await Promise.all([
      once(sender, 'open', { signal: AbortSignal.timeout(10000) }),
      once(recipient, 'open', { signal: AbortSignal.timeout(10000) }),
    ]);
    const received = once(recipient, 'message', { signal: AbortSignal.timeout(10000) });
    sender.send(payload);
    const data: unknown = (await received)[0];
    assert.deepEqual(data, typeof payload === 'string' ? Buffer.from(payload) : payload);
  }
  console.log('Extracted executable served its page and relayed text and file messages.');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  for (const client of clients) client.terminate();
  if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
