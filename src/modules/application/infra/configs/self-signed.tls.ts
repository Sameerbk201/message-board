import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, link, mkdir, mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { createSecureContext } from 'node:tls';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const runOpenSsl = promisify(execFile);

export const SELF_SIGNED_TLS_DIRECTORY = fileURLToPath(
  new URL('../../../../../tls/', import.meta.url)
);

/** Create a development certificate once; never replace an existing key pair. */
export async function ensureSelfSignedTls(
  directory = SELF_SIGNED_TLS_DIRECTORY
): Promise<{ key: Buffer; cert: Buffer }> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const keyPath = join(directory, 'server.key');
  const certPath = join(directory, 'server.crt');
  const hasKey = existsSync(keyPath);
  const hasCert = existsSync(certPath);

  if (hasKey !== hasCert) {
    throw new Error(
      'Incomplete TLS files: both server.key and server.crt are required. Existing files were preserved.'
    );
  }

  if (!hasKey) {
    const staging = await mkdtemp(join(directory, '.generate-'));
    const stagedKey = join(staging, 'server.key');
    const stagedCert = join(staging, 'server.crt');
    const names = new Set(['DNS:localhost', 'IP:127.0.0.1']);

    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === 'IPv4' && !address.internal) {
          names.add(`IP:${address.address}`);
        }
      }
    }

    try {
      await runOpenSsl(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-sha256',
          '-noenc',
          '-days',
          '365',
          '-subj',
          '/CN=Message Board Development',
          '-addext',
          `subjectAltName=${[...names].join(',')}`,
          '-addext',
          'basicConstraints=critical,CA:FALSE',
          '-addext',
          'keyUsage=critical,digitalSignature,keyEncipherment',
          '-addext',
          'extendedKeyUsage=serverAuth',
          '-keyout',
          stagedKey,
          '-out',
          stagedCert,
        ],
        { timeout: 15000 }
      );
      await chmod(stagedKey, 0o600);
      await link(stagedKey, keyPath);
      try {
        await link(stagedCert, certPath);
      } catch (error) {
        await unlink(keyPath);
        throw error;
      }
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  // shortcut: Existing certificates are reused, add renewal when LAN IPs change or they expire.
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
  createSecureContext({ key, cert });
  return { key, cert };
}
