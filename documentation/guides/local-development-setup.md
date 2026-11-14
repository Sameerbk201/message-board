# Local development setup

[Documentation index](../../README.md)

## Table of contents

- [Requirements](#requirements)
- [Install and start](#install-and-start)
- [Connect from the LAN](#connect-from-the-lan)
- [Configuration and commands](#configuration-and-commands)
- [Run the integration tests](#run-the-integration-tests)
- [Troubleshooting](#troubleshooting)
- [Container notes](#container-notes)

## Requirements

Use Node.js **22.13.0 or newer**, npm, and the OpenSSL command-line tool on `PATH`.
The process needs permission to create and read the repository's `tls/` directory and bind a TCP port.

The implemented app does not need MongoDB, Redis, Vault, RabbitMQ, or a seed step.
Some dependencies, scripts, and configuration comments were copied from the TrueHear backend;
their presence does not mean those services are used here.

## Install and start

Run these commands from the repository root:

```bash
npm ci
npm run dev
```

On first start, the server generates `tls/server.key` and `tls/server.crt` before opening its listener.
Later starts reuse that pair. See [self-signed TLS](../../src/modules/application/documentation/README.md#self-signed-tls)
for permissions, certificate names, and renewal.

Open [the local message board](https://localhost:8887/api/message-board).
The self-signed certificate is not automatically trusted: explicitly trust the generated public
certificate or accept the local certificate warning where the browser permits it.
Keep the private `server.key` on the server.

To run the compiled application:

```bash
npm run build
npm start
```

Keep `message-board.html` beside the `dist/` directory. TypeScript compilation produces the JavaScript;
the app still serves the HTML file from the repository root.

## Connect from the LAN

Startup logs include `Message board IPv4 address` entries with complete URLs.
Choose the Wi-Fi or Ethernet interface used by the other device; Docker and virtual-machine interfaces
can also appear in the logs.

For example, if that interface has `192.168.1.126`, open
`https://192.168.1.126:8887/api/message-board`. Substitute the server's current address.
The browser uses the page's host and port for WSS automatically.

`0.0.0.0` is the server's bind address. Clients use a concrete address such as its LAN IPv4 address.
HTTPS and WebSockets share one TCP port. Network routing, Wi-Fi client isolation, and firewall rules
still determine whether another device can reach it.

## Configuration and commands

| Setting                | Current behavior                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Bind address           | Fixed to `0.0.0.0` in `src/server.ts`.                                                 |
| `PORT`                 | Environment variable; defaults to `8887`. Must be an integer from `0` through `65535`. |
| Port `0`               | Requests an available port; mainly useful for integration tests.                       |
| TLS files              | Repository-root `tls/server.key` and `tls/server.crt`.                                 |
| Page and socket path   | `/api/message-board`, using HTTPS GET or a WSS upgrade.                                |
| Incoming message limit | `64 * 1024` bytes of UTF-8 text.                                                       |

For a different port in a POSIX shell:

```bash
PORT=9999 npm run dev
```

The application does not load a `.env` file at runtime. Export variables in the shell or provide them
through the process environment. The integration-test configuration separately supports dotenv files.

| Command                    | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `npm run dev`              | Watch and run `src/server.ts` with tsx.    |
| `npm run build`            | Clean `dist/` and compile with TypeScript. |
| `npm start`                | Run `dist/server.js`.                      |
| `npm run typecheck`        | Check application TypeScript.              |
| `npm run typecheck:tests`  | Check test TypeScript.                     |
| `npm run lint`             | Lint application source.                   |
| `npm run lint:markdown`    | Lint repository Markdown.                  |
| `npm run test:integration` | Run the implemented integration suites.    |

Copied commands for seeding, infrastructure setup, releases, licenses, and esbuild reference files
that this app does not contain. Use the commands above for the current implementation.

## Run the integration tests

```bash
npm run test:integration
```

The default `npm test` configuration excludes the integration directories. Use the explicit integration
command for this app's current tests. They use real HTTPS/WSS listeners, Supertest, the ws client,
temporary TLS directories, and OpenSSL; no external service is required.
The server tests may generate the root TLS pair if it is absent and reuse it if it already exists.

Test ownership is documented in the [application](../../src/modules/application/documentation/README.md#tests-and-verification)
and [socket](../../src/modules/socket/documentation/README.md#tests-and-verification) guides.

## Troubleshooting

| Symptom                                         | Check                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Site cannot be reached                          | Confirm the process is running, use the logged LAN URL with the correct port, and check TCP reachability.    |
| Ping works but the page fails                   | Ping tests ICMP; the page and WSS need TCP access to the listening port.                                     |
| Certificate warning                             | The certificate is self-signed. Verify that this is your server and explicitly trust its public certificate. |
| Certificate no longer matches the LAN address   | Existing certificates are reused. Follow the TLS guide to deliberately regenerate the pair.                  |
| Startup reports incomplete or invalid TLS files | Restore a matching key/certificate pair, or follow the TLS guide to replace both together.                   |
| Page loads but shows Disconnected               | Check browser certificate acceptance, server logs, and that a proxy supports WebSocket upgrades.             |
| Copy is blocked                                 | The UI selects the text for manual copying; browser clipboard permissions can still restrict copying.        |
| No tests found with `npm test`                  | Run `npm run test:integration`.                                                                              |

## Container notes

See [Docker setup and run](../containerization/README.md) for the complete build, Linux LAN networking,
certificate volume, healthcheck, logs, stop/start, and update instructions.

Build the image from this repository root:

```bash
docker build -t message-board .
```

The build installs the public npm dependencies directly; it does not require an npm configuration
secret, private SDK, or GitHub token.
