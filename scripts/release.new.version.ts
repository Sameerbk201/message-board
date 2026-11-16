import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0] ?? ''} failed with exit code ${String(result.status)}.`);
  }
  return result.stdout.trim();
}

function runVisible(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0] ?? ''} failed with exit code ${String(result.status)}.`);
  }
}

function main(): void {
  const versionChange = process.argv[2] ?? 'patch';
  if (process.argv.length > 3 || !['patch', 'minor', 'major'].includes(versionChange)) {
    throw new Error('Use: npm run release:message-board -- [patch|minor|major]');
  }
  if (run('git', ['branch', '--show-current']) !== 'main') {
    throw new Error('Releases must start from main. Switch to main and update it first.');
  }
  const initialChanges = run('git', ['status', '--porcelain']);
  if (initialChanges)
    throw new Error(`Working tree is not clean. Review these files:\n${initialChanges}`);
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this script with npm run release:message-board.');

  for (const file of [
    'package.json',
    'package-lock.json',
    'message-board.html',
    'sea-config.json',
    'scripts/build.sea.mjs',
    'scripts/smoke.sea.ts',
    'documentation/releases/README.txt',
    '.github/workflows/create-release-draft.yml',
    '.github/workflows/publish-standalone.yml',
  ]) {
    if (!existsSync(join(repositoryRoot, file))) throw new Error(`Missing release file: ${file}`);
  }

  runVisible('git', ['fetch', '--tags', 'origin', 'main']);
  if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', 'FETCH_HEAD'])) {
    throw new Error('main differs from origin/main. Inspect it and update main before releasing.');
  }

  for (const args of [
    ['ci'],
    ['run', 'lint:all'],
    ['run', 'typecheck:all'],
    ['run', 'test:integration'],
    ['run', 'build:bundle'],
  ]) {
    runVisible(process.execPath, [npmCli, ...args]);
  }
  const checkedChanges = run('git', ['status', '--porcelain']);
  if (checkedChanges)
    throw new Error(`Checks changed the working tree. Review these files:\n${checkedChanges}`);

  try {
    runVisible(process.execPath, [
      npmCli,
      'version',
      versionChange,
      '--git-tag-version=true',
      '--tag-version-prefix=v',
      '-m',
      'chore(release): message board v%s',
    ]);
  } catch {
    throw new Error(
      'Versioning failed. Inspect the working tree, commits, and tags before retrying.'
    );
  }

  const packageJson: unknown = JSON.parse(
    readFileSync(join(repositoryRoot, 'package.json'), 'utf8')
  );
  if (
    typeof packageJson !== 'object' ||
    packageJson === null ||
    !('version' in packageJson) ||
    typeof packageJson.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(packageJson.version)
  ) {
    throw new Error(
      'Invalid version after versioning. Inspect the release commit and tag before retrying.'
    );
  }
  const tag = `v${packageJson.version}`;
  if (
    run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', `refs/tags/${tag}^{commit}`])
  ) {
    throw new Error(
      `Tag ${tag} does not point to HEAD. Inspect the release commit and tag before retrying.`
    );
  }
  const versionChanges = run('git', ['status', '--porcelain']);
  if (versionChanges)
    throw new Error(`Versioning left changes. Inspect before retrying:\n${versionChanges}`);

  try {
    runVisible('git', ['push', '--atomic', 'origin', 'main', `refs/tags/${tag}`]);
  } catch {
    throw new Error(
      `Local release commit and ${tag} exist, but the push failed. Resolve it and run:\n` +
        `  git push --atomic origin main refs/tags/${tag}\n` +
        'Do not run the release script again for this version.'
    );
  }
  console.log(`Pushed ${tag}. Review and publish the GitHub draft release.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
