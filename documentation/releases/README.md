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

## Prerequisites

Merge the intended changes and both workflows into `main` before releasing. Install Node.js 24, npm,
Git, GitHub CLI (`gh`), and OpenSSL 3 or newer. Authenticate Git and `gh` with an account allowed to
push to `main`, push tags, and publish releases. Check that GitHub Actions is enabled and that the
repository permits the workflows to use `GITHUB_TOKEN` with `contents: write`.

Both release paths create a commit and tag and push them to GitHub. Publishing the draft makes the
release visible **before** the platform builds finish. Review the source and the draft first.

## Step 1: prepare main

Run from the repository root. Stop if the first status shows changes; review them before switching.

```bash
git status --short
git switch main
git fetch --tags origin main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git rev-parse FETCH_HEAD
```

The final status must be empty and the two commit IDs must match. The tag must include the
[draft workflow](../../.github/workflows/create-release-draft.yml) and
[packaging workflow](../../.github/workflows/publish-standalone.yml).

## Step 2: create and push the release

Choose **one** of the following paths. Both push the version commit and its tag atomically to `origin`.

### Option A: release with the script

```bash
npm run release:message-board          # patch: 3.0.11 -> 3.0.12
npm run release:message-board -- minor # 3.0.11 -> 3.1.0
npm run release:message-board -- major # 3.0.11 -> 4.0.0
```

Run only one command. The script checks `main`, the clean tree, required release files, and equality
with fetched `origin/main`. It then runs `npm ci`, all lint and type checks, the real integration tests,
and the TypeScript/esbuild bundle. It checks the tree again before using `npm version` to update
`package.json` and `package-lock.json`, create the version commit and `v` tag, and atomically push both.
Patch is the default, including when there are no previous tags. It does not publish the draft or
build all platform executables locally.

### Option B: release manually

First run the same release checks. OpenSSL must be on `PATH`; the integration suite opens local
HTTPS and WebSocket listeners and may create the ignored local `tls/` certificate pair.

```bash
npm ci
npm run lint:all
npm run typecheck:all
npm run test:integration
npm run build:bundle
git status --short
```

Stop if a command fails or the final status is not empty. Choose a new version; the example assumes
the current version is `3.0.11` and the next release is `3.0.12`. Replace it with your chosen version:

```bash
release_version=3.0.12
release_tag="v${release_version}"
git tag --list "$release_tag"
```

The last command must print nothing. The earlier `git fetch --tags` makes this check include fetched
remote tags. Update the version files, then inspect the diff before committing:

```bash
npm version "$release_version" --no-git-tag-version
git diff -- package.json package-lock.json
```

After checking the version, create the commit and annotated tag and push both:

```bash
git add package.json package-lock.json
git commit -m "chore(release): message board ${release_tag}"
git tag -a "$release_tag" -m "Message Board ${release_tag}"
git push --atomic origin main "refs/tags/${release_tag}"
```

## Step 3: review and publish the GitHub draft

The tag push starts the draft workflow. Get the tag for the just-created release and find the run:

```bash
release_tag="v$(node -p "require('./package.json').version")"
gh run list --workflow create-release-draft.yml --limit 5
gh release view "$release_tag" --web
```

Wait for the draft workflow to finish. Review the draft tag, target commit, title, and notes in
GitHub. When ready, publish it using the GitHub UI or this command:

```bash
gh release edit "$release_tag" --draft=false
```

The repository-provided `GITHUB_TOKEN` creates the draft and uploads assets. A tag pushed by another
workflow using `GITHUB_TOKEN` does not normally trigger the draft workflow; push the tag using your
maintainer Git credentials or create the draft separately.

## Step 4: monitor and verify the assets

Publishing the draft starts the packaging workflow. Find its run ID, then replace `RUN_ID` below:

```bash
gh run list --workflow publish-standalone.yml --limit 5
gh run watch RUN_ID
gh release view "$release_tag" --json assets --jq '.assets[].name'
```

Each platform builds on its native runner, archives and extracts its ZIP, and checks HTTPS plus text
and file WebSockets. The attach job uploads the three ZIPs only after all platform jobs pass. Confirm
the three asset names in the table above and test the downloaded executable on the intended machine.

## Failure recovery

- If a check fails before versioning, fix it and run the chosen release path again.
- If versioning fails, inspect `git status`, `git log`, and `git tag` before retrying; a commit or tag
  may already exist.
- If the atomic push fails, inspect the local and remote state. The script prints the exact retry
  command; do not run it again and bump the version twice. For the manual path:

  ```bash
  git push --atomic origin main "refs/tags/${release_tag}"
  ```

- If a draft or packaging job fails, inspect its logs and the existing release before retrying. Asset
  upload can leave a partial set; the workflow does not overwrite existing assets. Do not move or
  reuse a published tag.

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
