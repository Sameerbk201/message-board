import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

describe('release script guards', () => {
  const directory = mkdtempSync(join(tmpdir(), 'message-board-release-'));
  const script = join(directory, 'scripts', 'release.new.version.ts');

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('rejects invalid arguments, the wrong branch, and an unclean tree before fetching', () => {
    mkdirSync(join(directory, 'scripts'));
    copyFileSync(join(process.cwd(), 'scripts', 'release.new.version.ts'), script);
    const git = (args: string[]): void => {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      expect(result.status).toBe(0);
    };
    const release = (args: string[]): ReturnType<typeof spawnSync> =>
      spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

    git(['init', '-b', 'other']);
    const invalid = release(['unexpected']);
    expect(invalid.status).toBe(1);
    expect(String(invalid.stderr)).toContain('Use: npm run release:message-board');

    const wrongBranch = release([]);
    expect(wrongBranch.status).toBe(1);
    expect(String(wrongBranch.stderr)).toContain('Releases must start from main');

    git(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    const dirty = release([]);
    expect(dirty.status).toBe(1);
    expect(String(dirty.stderr)).toContain('Working tree is not clean');
  });
});
