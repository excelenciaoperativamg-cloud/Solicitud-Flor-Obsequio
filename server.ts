import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import indexHandler from './api/index.js';
import driveConfigHandler from './api/_handlers/drive-config.js';
import driveTestHandler from './api/_handlers/drive-test.js';
import maestroHandler from './api/_handlers/maestro.js';
import pingHandler from './api/_handlers/ping.js';
import solicitudesHandler from './api/_handlers/solicitudes.js';
import solicitudesIntExtHandler from './api/_handlers/solicitudes-int-ext.js';
import especialesPersonalHandler from './api/_handlers/especiales-personal.js';
import solicitudComunidadHandler from './api/_handlers/solicitud-comunidad.js';
import ingresosSeleccionHandler from './api/_handlers/ingresos-seleccion.js';
import obsequioVisitantesHandler from './api/_handlers/obsequio-visitantes.js';
import permisosHandler from './api/_handlers/permisos.js';
import maestroSyncHandler from './api/_handlers/maestro-sync-from-drive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : undefined;
const PORT = cliPort && !Number.isNaN(cliPort) ? cliPort : 3000;

app.use(express.json({ limit: '10mb' }));

// API Endpoints unificados con los Serverless Functions de Vercel
app.all('/api', (req, res) => indexHandler(req, res));
app.all('/api/ping', (req, res) => pingHandler(req, res));
app.all('/api/drive-config', (req, res) => driveConfigHandler(req, res));
app.all('/api/drive-test', (req, res) => driveTestHandler(req, res));
app.all('/api/maestro', (req, res) => maestroHandler(req, res));
app.all('/api/solicitudes', (req, res) => solicitudesHandler(req, res));
app.all('/api/solicitudes-int-ext', (req, res) => solicitudesIntExtHandler(req, res));
app.all('/api/solicitudes-int-ext/carta/:file', (req, res) => solicitudesIntExtHandler(req, res));
app.all('/api/especiales-personal', (req, res) => especialesPersonalHandler(req, res));
app.all('/api/especiales-personal/carta/:file', (req, res) => especialesPersonalHandler(req, res));
app.all('/api/solicitud-comunidad', (req, res) => solicitudComunidadHandler(req, res));
app.all('/api/solicitud-comunidad/carta/:file', (req, res) => solicitudComunidadHandler(req, res));
app.all('/api/ingresos-seleccion', (req, res) => ingresosSeleccionHandler(req, res));
app.all('/api/obsequio-visitantes', (req, res) => obsequioVisitantesHandler(req, res));
app.all('/api/permisos', (req, res) => permisosHandler(req, res));
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
