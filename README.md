# Welcome to Message Board

**Version:** 3.0.11 · **Author:** Message Board

Message Board shares temporary text messages and files with everyone connected to one server.
Express serves the browser interface, and native WebSockets broadcast over the same HTTPS listener.
Messages and files stay in connected browsers; the server keeps no history or files.

## Documentation

| Topic                                                                      | What it covers                                                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [Local development setup](documentation/guides/local-development-setup.md) | Requirements, installation, commands, LAN access, troubleshooting, and container notes.                   |
| [Docker setup and run](documentation/containerization/README.md)           | Build the image, run on the Linux LAN, retain TLS certificates, inspect health, and manage the container. |
| [Standalone releases](documentation/releases/README.md)                    | Build, publish, verify, and run the standalone executable releases.                                       |
| [Application and server](src/modules/application/documentation/README.md)  | HTTP routes, startup, self-signed TLS, IPv4 logging, shutdown, and integration tests.                     |
| [Socket module](src/modules/socket/documentation/README.md)                | Inbound and outbound ports, service, adapter, toolkit DI, events, connection tracking, and examples.      |
| [Browser interface](documentation/client/README.md)                        | Automatic connections, sending long messages, clipboard copying, and temporary message lifetime.          |

Keep this README as the documentation index. Add feature details beside their owning module and link them here.

## Project structure

```text
message-board.html                         Browser interface
src/app.ts                                 Express application composition
src/server.ts                              HTTPS/WebSocket listener and process lifecycle
src/modules/application/                   Development TLS configuration and tests
src/modules/socket/                        Ports, service, ws adapter, toolkit, and tests
```
