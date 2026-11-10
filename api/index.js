export default function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    service: 'MG Consultores - Sistema Flor de Obsequio API',
    endpoints: ['/api/solicitudes', '/api/maestro', '/api/drive-config', '/api/drive-test', '/api/maestro/sync-from-drive'],
  });
}
