import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import indexHandler from './api/index.js';
import driveConfigHandler from './api/drive-config.js';
import driveTestHandler from './api/drive-test.js';
import maestroHandler from './api/maestro.js';
import solicitudesHandler from './api/solicitudes.js';
import maestroSyncHandler from './api/maestro/sync-from-drive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API Endpoints unificados con los Serverless Functions de Vercel
app.all('/api', (req, res) => indexHandler(req, res));
app.all('/api/drive-config', (req, res) => driveConfigHandler(req, res));
app.all('/api/drive-test', (req, res) => driveTestHandler(req, res));
app.all('/api/maestro', (req, res) => maestroHandler(req, res));
app.all('/api/solicitudes', (req, res) => solicitudesHandler(req, res));
app.all('/api/maestro/sync-from-drive', (req, res) => maestroSyncHandler(req, res));

// Iniciar servidor Vite o estático
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Flor de Obsequio ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
