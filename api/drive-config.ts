import { getDriveConfigStorage, saveDriveConfigStorage } from './_lib/storage';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') {
      const { webhookUrl, spreadsheetUrl } = req.body || {};
      const current = getDriveConfigStorage();
      const updated = {
        ...current,
        webhookUrl: (webhookUrl !== undefined ? webhookUrl : current.webhookUrl || '').trim(),
        spreadsheetUrl: (
          spreadsheetUrl !== undefined
            ? spreadsheetUrl
            : current.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1ecAKLTKJ-qrIWMGI5Rk1SpxhlTpfY6k5Gkyl4b5efzA/edit'
        ).trim(),
        syncEnabled: true,
        lastUpdated: new Date().toISOString(),
      };
      saveDriveConfigStorage(updated);
      return res.status(200).json({ success: true, config: updated });
    }

    // GET
    const cfg = getDriveConfigStorage();
    return res.status(200).json({ success: true, config: cfg });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error en drive-config' });
  }
}
