# Welcome to Message Board

**Version:** See [package.json](package.json) · **Author:** Message Board

Message Board shares temporary text messages and files with everyone connected to one server.
Express serves the browser interface, and native WebSockets broadcast over the same HTTPS listener.
Messages and files stay in connected browsers; the server keeps no history or files.

## Install the latest release

1. Open the [latest GitHub release](https://github.com/Sameerbk201/message-board/releases/latest)
   and download the ZIP for your computer:

   | Computer            | Download                        |
   | ------------------- | ------------------------------- |
   | Windows x64         | `message-board-windows-x64.zip` |
   | Linux x64           | `message-board-linux-x64.zip`   |
   | macOS Apple Silicon | `message-board-macos-arm64.zip` |

2. Make sure OpenSSL 3 or newer is available in your terminal:

   ```bash
   openssl version
   ```

   The executable includes Node.js; you do not need to install Node.js.

3. Extract the ZIP and start the executable. The commands below assume the ZIP is in `Downloads`.

   **macOS Apple Silicon:**

   ```bash
   cd ~/Downloads
   unzip message-board-macos-arm64.zip -d message-board
   chmod +x message-board/message-board
   ./message-board/message-board
   ```

   If macOS blocks the downloaded executable, first verify that you trust the download, then remove
   its quarantine attribute and run it again:

   ```bash
   xattr -d com.apple.quarantine ~/Downloads/message-board/message-board
   ```

   **Linux x64:**

   ```bash
   cd ~/Downloads
   unzip message-board-linux-x64.zip -d message-board
   chmod +x message-board/message-board
   ./message-board/message-board
   ```

   **Windows x64 (PowerShell):**

   ```powershell
   cd $HOME\Downloads
   Expand-Archive .\message-board-windows-x64.zip -DestinationPath .\message-board
   .\message-board\message-board.exe
   ```

4. Open [https://localhost:8887/api/message-board](https://localhost:8887/api/message-board).
   The first start creates a self-signed certificate in `~/.message-board/tls/`; your browser must
   trust it. Keep the terminal open while using the board, and press **Ctrl+C** to stop the server.

To choose a different port, pass it as the first argument:

```bash
./message-board/message-board 9999
```

The argument overrides the `PORT` environment variable. Without either, the port is `8887`.
For the example above, open `https://localhost:9999/api/message-board`.

The executables do not have a publisher signature. The macOS executable is ad hoc signed and is not
notarized. If the latest release has no ZIPs yet, its platform builds may still be running.

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
