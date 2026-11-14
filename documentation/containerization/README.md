# Docker setup and run

[Documentation index](../../README.md) · [Local development setup](../guides/local-development-setup.md)

The [Dockerfile](../../Dockerfile) installs dependencies, compiles TypeScript, and runs the HTTPS/WSS app
as the non-root `node` user. It includes the browser HTML and OpenSSL for self-signed certificate generation.
The build uses public npm packages and does not require an `.npmrc` secret or GitHub token.

## Table of contents

- [Requirements](#requirements)
- [Build the image](#build-the-image)
- [Run on your Linux network](#run-on-your-linux-network)
- [Logs and health](#logs-and-health)
- [Stop, start, and update](#stop-start-and-update)
- [TLS certificate lifetime](#tls-certificate-lifetime)
- [Troubleshooting](#troubleshooting)

## Requirements

Use Docker Engine on Linux with a running daemon and permission to run Docker commands.
Check the client and daemon connection:

```bash
docker version
```

The build needs network access to download the Node image, public npm dependencies, and OpenSSL.
Local Node.js and npm installations are not required for the Docker build.

The run command below uses port `8887` directly on the host. Stop the local `npm run dev` process first
if it already uses that port.

## Build the image

From the repository root:

```bash
docker build -t message-board .
```

The build stage runs `npm ci`, `npm run build`, and `npm prune --omit=dev`.
The runtime receives the compiled code, production dependencies, and `message-board.html`.
Local TLS files and `.npmrc` are excluded from the build context.
The image build compiles the app; it does not run the integration tests.

## Run on your Linux network

```bash
docker run -d \
  --name message-board \
  --network host \
  --mount type=volume,source=message-board-tls,target=/app/tls \
  message-board
```

[Host networking](https://docs.docker.com/engine/network/drivers/host/) shares the Linux host's network
namespace. The app listens on `0.0.0.0:8887` using the computer's network interfaces.
No `-p` mapping is needed with this network mode. The certificate helper uses the interfaces it can see
when generating its certificate, so a first start in this mode includes the current host IPv4 addresses.

Open `https://localhost:8887/api/message-board` on the server, or
`https://<server-LAN-IP>:8887/api/message-board` on another device.
Use the Wi-Fi or Ethernet IPv4 address shown in the logs. HTTPS and WSS share the same port.
The self-signed certificate still requires explicit browser trust or acceptance.

The named [Docker volume](https://docs.docker.com/engine/storage/volumes/) retains the files under
`/app/tls` when the container is removed and recreated. Docker creates the named volume if it is absent.
It stores the TLS key and certificate; the app does not save message history.

This run command targets Docker Engine on Linux. Docker Desktop has separate host-networking requirements;
see the linked Docker documentation before using it on another platform.

## Logs and health

```bash
docker logs -f message-board
```

Logs show startup, IPv4 URLs, WebSocket connection events, and errors.
Press Ctrl+C to stop following the logs; the detached container keeps running.

Inspect the running container and healthcheck:

```bash
docker ps --filter name=message-board
docker inspect --format '{{.State.Health.Status}}' message-board
```

The healthcheck requests `https://127.0.0.1:8887/api/message-board` inside the container and trusts its
generated `server.crt`. It expects HTTP `200`. Health may show `starting` until the first successful check.

This Dockerfile sets `PORT=8887`, and the healthcheck targets that port. Changing the container's
`PORT` also requires changing the healthcheck URL.

## Stop, start, and update

Stop the container, then start the same container again when needed:

```bash
docker stop message-board
docker start message-board
```

After changing application code, build the image and replace the old container:

```bash
docker build -t message-board .
docker stop message-board
docker rm message-board
```

Repeat the [run command](#run-on-your-linux-network) with the same `message-board-tls` volume.
The new container uses the rebuilt image and reuses the existing certificate pair.

## TLS certificate lifetime

On first startup, OpenSSL generates `/app/tls/server.key` and `/app/tls/server.crt`.
The image prepares that directory for the non-root runtime user. A reused or manually supplied volume
must remain writable by that user, and its private key must be readable by it.

Certificates are reused on later starts, including container replacement with the same volume.
They do not automatically renew or gain new IP names after a LAN address change.
Follow the [TLS lifecycle guide](../../src/modules/application/documentation/README.md#self-signed-tls)
to deliberately replace the pair in `/app/tls`; clients must then trust the replacement certificate.

If using bridge networking with published ports instead of the documented Linux host mode, generated
names reflect container interfaces. Supply a certificate pair containing the external host IP or DNS name
when clients connect through that address.

## Troubleshooting

| Symptom                                    | Check                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Cannot connect to the Docker daemon        | Check that Docker is running and that your user has access to it.                                         |
| Container name is already in use           | Use `docker start message-board` for the existing stopped container, or remove it before recreating.      |
| App logs `EADDRINUSE`                      | Another host process already owns port `8887`; stop that process before starting this container.          |
| Container exits immediately                | Read `docker logs message-board` for a startup, TLS, or permission error.                                 |
| TLS permission error                       | Check the mounted directory and files are accessible to the runtime's non-root `node` user.               |
| Certificate does not match the LAN address | Check whether a reused certificate predates the address change, or was generated in bridge mode.          |
| Browser cannot reach the URL               | Confirm the container is running, use the host's current LAN IP, and check network/firewall reachability. |

A successful healthcheck proves a local HTTPS response. Access from another physical device and browser
certificate acceptance require checking on that device.
