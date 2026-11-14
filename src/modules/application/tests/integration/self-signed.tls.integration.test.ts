import { X509Certificate } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureSelfSignedTls } from '../../infra/configs/self-signed.tls.js';

describe('self-signed development TLS', () => {
  let workspace: string;
  let directory: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'message-board-tls-test-'));
    directory = join(workspace, 'tls');
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('generates a usable server certificate for localhost and current IPv4 addresses', async () => {
    const { cert } = await ensureSelfSignedTls(directory);
    const certificate = new X509Certificate(cert);

    expect(certificate.checkHost('localhost')).toBe('localhost');
    expect(certificate.checkIP('127.0.0.1')).toBe('127.0.0.1');
    expect(certificate.verify(certificate.publicKey)).toBe(true);
    expect(certificate.ca).toBe(false);
    expect(Date.parse(certificate.validFrom)).toBeLessThanOrEqual(Date.now());
    expect(Date.parse(certificate.validTo)).toBeGreaterThan(Date.now());

    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family !== 'IPv4' || address.internal) {
          continue;
        }
        expect(certificate.checkIP(address.address)).toBe(address.address);
      }
    }

    expect(await readdir(directory)).toEqual(['server.crt', 'server.key']);
  });

  it('reuses the same private key and certificate on subsequent starts', async () => {
    const first = await ensureSelfSignedTls(directory);
    const second = await ensureSelfSignedTls(directory);

    expect(second.key.equals(first.key)).toBe(true);
    expect(second.cert).toEqual(first.cert);
  });

  it.skipIf(process.platform === 'win32')(
    'restricts the private key and directory permissions on Unix',
    async () => {
      await ensureSelfSignedTls(directory);

      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      expect((await stat(join(directory, 'server.key'))).mode & 0o777).toBe(0o600);
    }
  );

  it.each(['server.key', 'server.crt'])(
    'preserves an existing %s when its partner file is missing',
    async (filename) => {
      await ensureSelfSignedTls(directory);
      const preserved = await readFile(join(directory, filename));
      const missing = filename === 'server.key' ? 'server.crt' : 'server.key';
      await rm(join(directory, missing));

      await expect(ensureSelfSignedTls(directory)).rejects.toThrow('Incomplete TLS files');

      expect((await readFile(join(directory, filename))).equals(preserved)).toBe(true);
      expect(await readdir(directory)).toEqual([filename]);
    }
  );

  it('rejects malformed material without overwriting either file', async () => {
    await ensureSelfSignedTls(directory);
    const certificate = await readFile(join(directory, 'server.crt'));
    await writeFile(join(directory, 'server.key'), 'invalid private key', { mode: 0o600 });

    await expect(ensureSelfSignedTls(directory)).rejects.toThrow();

    expect(await readFile(join(directory, 'server.key'), 'utf8')).toBe('invalid private key');
    expect(await readFile(join(directory, 'server.crt'))).toEqual(certificate);
  });

  it('rejects a certificate that does not match the preserved private key', async () => {
    const first = await ensureSelfSignedTls(directory);
    const other = await ensureSelfSignedTls(join(workspace, 'other-tls'));
    await writeFile(join(directory, 'server.crt'), other.cert);

    await expect(ensureSelfSignedTls(directory)).rejects.toThrow();

    expect((await readFile(join(directory, 'server.key'))).equals(first.key)).toBe(true);
    expect(await readFile(join(directory, 'server.crt'))).toEqual(other.cert);
  });
});
