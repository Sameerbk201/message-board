# Browser Interface

**Documentation version:** 1.0.0  
**Status:** Implemented  
**Last updated:** 2026-11-14

[Documentation index](../../README.md)

The client is the single [`message-board.html`](../../message-board.html) file.
Its HTML, CSS, and browser JavaScript need no frontend build or external UI library.

## Table of contents

- [Open and connect](#open-and-connect)
- [Send long messages](#send-long-messages)
- [Copy a message](#copy-a-message)
- [Message lifetime](#message-lifetime)
- [Browser connection example](#browser-connection-example)
- [Verification](#verification)

## Open and connect

Open the page from the running server at `https://<server-address>:8887/api/message-board`.
Use the actual port when `PORT` is overridden. Follow the
[setup guide](../guides/local-development-setup.md) for certificate trust and LAN access.

The page displays `window.location.host` and automatically opens:

```js
new WebSocket('/api/message-board');
```

The browser resolves that path against the page URL. An HTTPS page therefore connects using
WSS to the same host and port, with no hard-coded IP or separate socket-port configuration.
Serve the file through Express so it has the correct server origin.

The status shows Connecting, Connected, or Disconnected. Sending is enabled only while connected.
Choose Disconnect to leave, or Connect to create a fresh connection after leaving or losing it.
The client does not automatically retry a failed connection.

## Send long messages

Enter a message and choose Send. Enter sends; Shift + Enter inserts a line break.
An active input-method composition is allowed to finish before Enter sends.

The UI counts UTF-8 bytes with `TextEncoder`, displays usage in KiB, and enforces the same
**64 KiB (65,536 bytes)** limit as the server. Unicode characters can use several bytes.
An oversized draft remains in the textarea for editing; it is not silently truncated.
Sending becomes available again after the draft is within the limit and contains non-whitespace text.

The server broadcasts accepted text back to every connected browser, including the sender.
The client adds a message when it receives that broadcast. It displays text with `textContent`,
preserving line breaks and whitespace without executing message markup.
The displayed time is the receiving browser's local time when the message arrives.

## Copy a message

Each received message has a Copy button. It passes the complete message text to
`navigator.clipboard.writeText()`, preserving whitespace, line breaks, and Unicode.
Success changes the button label to Copied and announces confirmation through a live status region.

Clipboard availability depends on the browser's secure-context and permission rules, including its
handling of the self-signed certificate. If writing is unavailable or denied, the UI selects the message
and shows instructions to copy manually using the browser's normal copy action.
The button remains usable after success or failure.

Copying explicitly places text in the system clipboard. Clearing the message board does not clear
that clipboard.

## Message lifetime

The server retains connected sockets but no message history. The client keeps messages in its current DOM;
it does not write them to localStorage, sessionStorage, IndexedDB, or a database.

| Event                                | Result                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| Send succeeds                        | Clear the draft; display the message when its broadcast arrives. |
| Disconnect or socket closure         | Clear this browser's messages and draft; disable sending.        |
| Reconnect                            | Start an empty interface and receive future messages only.       |
| Page refresh or navigation away      | Clear the page's session and close its socket.                   |
| Return from the browser's page cache | Establish a fresh connection.                                    |
| Another client disconnects           | Other connected browsers retain their own visible messages.      |

This is temporary application storage, not a guarantee that recipients cannot copy or capture messages.
A long session can accumulate messages in browser memory until its connection ends.

## Browser connection example

From JavaScript running on the served page's origin:

```js
const socket = new WebSocket('/api/message-board');

socket.addEventListener('open', () => {
  socket.send('Hello from the browser 👋');
});

socket.addEventListener('message', (event) => {
  console.log(event.data);
});

socket.addEventListener('error', () => {
  console.error('WebSocket connection failed');
});
```

These are native WebSockets using plain text frames; Socket.IO event envelopes are not part of this protocol.
Client code that opens its own socket also owns closing it when finished.

## Verification

The committed [server tests](../../src/modules/socket/tests/integration/message-board.server.integration.test.ts)
cover serving the HTML, WSS broadcasts, message boundaries, and no history replay.

Browser checks for the current UI were executed separately in real Chrome: two-tab messaging,
literal markup rendering, disconnect/reconnect and refresh behavior, mobile layout, long multiline Unicode
messages, exact clipboard contents, over-limit drafts, and manual-copy fallback after clipboard denial.
There is no committed automated browser-test runner; the integration suite does not exercise clipboard APIs.
Access and certificate acceptance on other physical devices remain environment-specific checks.
