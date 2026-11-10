import { getDriveConfigStorage, saveDriveConfigStorage, DEFAULT_CONFIG } from './_lib/storage.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { webhookUrl, spreadsheetUrl } = req.body || {};
      const current = getDriveConfigStorage();
      const updated = {
        ...current,
        webhookUrl: (webhookUrl !== undefined ? webhookUrl : current.webhookUrl || '').trim(),
        spreadsheetUrl: (
          spreadsheetUrl !== undefined ? spreadsheetUrl : current.spreadsheetUrl || DEFAULT_CONFIG.spreadsheetUrl
        ).trim(),
        syncEnabled: true,
        lastUpdated: new Date().toISOString(),
      };
      saveDriveConfigStorage(updated);
      return res.status(200).json({ success: true, config: updated });
    }
    return res.status(200).json({ success: true, config: getDriveConfigStorage() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Error en drive-config' });
  }
}
