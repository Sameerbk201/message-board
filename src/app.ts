import { join } from 'node:path';
import { getAsset, isSea } from 'node:sea';

import express from 'express';
import type { Express } from 'express';

import { PROJECT_ROOT } from './project.root.js';

export const clientPath = join(PROJECT_ROOT, 'message-board.html');

/** Build the HTTP application without opening a listening port. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/message-board', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    if (isSea()) {
      res.type('html').send(getAsset('message-board.html', 'utf8'));
    } else {
      res.sendFile(clientPath);
    }
  });

  app.use((_req, res) => {
    res.status(404).type('text').send('404 not found');
  });

  return app;
}
