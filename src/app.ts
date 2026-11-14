import { fileURLToPath } from 'node:url';

import express from 'express';
import type { Express } from 'express';

export const clientPath = fileURLToPath(new URL('../message-board.html', import.meta.url));

/** Build the HTTP application without opening a listening port. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/message-board', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(clientPath);
  });

  app.use((_req, res) => {
    res.status(404).type('text').send('404 not found');
  });

  return app;
}
