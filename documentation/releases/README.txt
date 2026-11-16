Message Board standalone release

This archive contains the Message Board executable and its embedded browser interface.
Node.js is not required. A compatible OpenSSL command (version 3 or newer) must be available on PATH.

Run the executable in a terminal:
  Windows:  .\message-board.exe
  macOS/Linux: ./message-board

Open https://localhost:8887/api/message-board. The server also logs its LAN addresses.
The first start generates a self-signed certificate and private key in ~/.message-board/tls/.
Browsers must trust the certificate before connecting. Keep the private key on the server.
Messages and files are shared with connected clients; the server does not store their contents.
Press Ctrl+C to stop the server.

The executables have no publisher signature. The macOS executable is ad hoc signed and is not
notarized. Your operating system or browser may display warnings; verify the source before trusting it.
