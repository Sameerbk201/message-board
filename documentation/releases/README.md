# Standalone executable releases

**Last updated:** 2026-11-16

[Documentation index](../../README.md)

The release workflows are configured in the repository; they have not yet been verified by a
completed GitHub release run. Like the Truehear daemon release flow, a version tag creates a draft,
and publishing that draft starts the executable builds.

| Platform            | Runner         | Release asset                   |
| ------------------- | -------------- | ------------------------------- |
| Windows x64         | `windows-2025` | `message-board-windows-x64.zip` |
| Linux x64           | `ubuntu-24.04` | `message-board-linux-x64.zip`   |
| macOS Apple Silicon | `macos-15`     | `message-board-macos-arm64.zip` |

Each ZIP contains the executable and [running instructions](README.txt). The executable embeds Node
and the HTML, but requires OpenSSL 3 or newer on `PATH`. It generates or reuses a self-signed key
and certificate in `~/.message-board/tls/`; the browser must trust the certificate. The executables
have no publisher signature. macOS uses ad hoc signing and is not notarized.

## Release flow

1. Merge and review the intended code and workflows on `main`, including the desired `package.json`
   version. Run the appropriate tests before creating a release.
2. Create and push a reviewed version tag such as `v3.0.11`. The tag must include the release
   workflows. The [draft workflow](../../.github/workflows/create-release-draft.yml) creates a draft
   with generated notes; it does not publish the release.
3. Review the draft's tag, commit, and notes in GitHub, then publish it. Publishing makes the
   release visible before the [packaging workflow](../../.github/workflows/publish-standalone.yml)
   finishes.
4. Monitor the packaging run. Each platform builds on its native runner, archives and extracts the
   ZIP, and checks HTTPS plus text and file WebSockets against the extracted executable. Only after
   all three jobs pass does the attach job upload the three ZIPs to the release.
5. Verify the assets and test the downloaded executable on the intended machine before distributing
   the release. A workflow smoke test does not verify every client or network environment.

```bash
gh run list --workflow create-release-draft.yml --limit 5
gh run list --workflow publish-standalone.yml --limit 5
gh release view v3.0.11
```

Replace `v3.0.11` with the actual release tag. The workflows use the repository `GITHUB_TOKEN`; the
draft job and attach job require `contents: write`. A tag created by a workflow using `GITHUB_TOKEN`
does not normally trigger the draft workflow; push it with maintainer credentials or create the draft
separately. No release, tag, signing certificate, or external secret is created by this guide.

If a job fails, inspect its logs and the existing draft or release before retrying. Uploading assets
can fail after a partial upload; the workflow does not overwrite existing release assets.

## Build locally

Install Node.js 24, OpenSSL 3 or newer, and the project dependencies, then run:

```bash
npm run build:sea
```

This produces the executable for the current supported OS and CPU in `dist/`; it does not cross-compile.
On macOS Apple Silicon, the existing `npm run build:sea:mac` command remains available. Run the
executable from a terminal and open `https://localhost:8887/api/message-board`; press Ctrl+C to stop it.

The release smoke test uses the running user's `~/.message-board/tls/` directory, so run it in a
disposable environment if an isolated certificate is required:

```bash
node --import tsx scripts/smoke.sea.ts dist/message-board-macos-arm64
```

Substitute the local executable path on Windows or Linux. Windows ARM, Linux ARM, and Intel macOS are
not produced by these workflows.
