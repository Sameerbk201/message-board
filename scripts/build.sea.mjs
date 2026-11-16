import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';

/** @type {Record<string, string>} */
const targets = {
  'darwin-arm64': 'macos-arm64',
  'linux-x64': 'linux-x64',
  'win32-x64': 'windows-x64.exe',
};
const target = targets[`${process.platform}-${process.arch}`];
if (!process.versions.node.startsWith('24.') || !target) {
  throw new Error('Node.js 24 on macOS arm64, Linux x64, or Windows x64 is required.');
}
if (process.argv[2] === '--mac' && process.platform !== 'darwin') {
  throw new Error('build:sea:mac requires macOS Apple Silicon.');
}

const executable = `dist/message-board-${target}`;
execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], {
  stdio: 'inherit',
});
copyFileSync(process.execPath, executable);
if (process.platform === 'darwin') {
  execFileSync('codesign', ['--remove-signature', executable], { stdio: 'inherit' });
}
const options = ['--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') options.push('--macho-segment-name', 'NODE_SEA');
execFileSync(
  process.execPath,
  [
    'node_modules/postject/dist/cli.js',
    executable,
    'NODE_SEA_BLOB',
    'dist/sea-prep.blob',
    ...options,
  ],
  { stdio: 'inherit' }
);
if (process.platform === 'darwin') {
  execFileSync('codesign', ['--sign', '-', executable], { stdio: 'inherit' });
}
console.log(`Built ${executable}`);
