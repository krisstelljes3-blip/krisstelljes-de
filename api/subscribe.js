// Vercel Serverless Function: Newsletter Subscribe via ActiveCampaign v3-API
// Legt den Kontakt an + setzt ihn auf Liste 4 "Der Wiederaufbau" (status=1 = aktiv/abonniert).
// status=1 triggert die AC-Automation "Kontakt abonniert Liste" -> Welcome-Mail wird sofort gesendet.
// Kein echtes DOI (AC Lite hat keinen nativen DOI-Toggle) - Entscheidung 22.06.2026.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://krisstelljes.de');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, firstName } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  const AC_KEY = process.env.AC_API_KEY;
  const AC_URL = 'https://krisstelljes3.api-us1.com/api/3';
  if (!AC_KEY) {
    console.error('AC_API_KEY not set');
    return res.status(500).json({ error: 'Not configured' });
  }
  try {
    const syncRes = await fetch(`${AC_URL}/contact/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
      body: JSON.stringify({ contact: { email, firstName: firstName || '' } })
    });
    const syncData = await syncRes.json();
    const contactId = syncData.contact && syncData.contact.id;
    if (!contactId) throw new Error('Contact sync failed: ' + JSON.stringify(syncData));
    // status=1 = aktiv, triggert Automation + Welcome-Mail
    await fetch(`${AC_URL}/contactLists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Token': AC_KEY },
      body: JSON.stringify({
        contactList: { list: 4, contact: contactId, status: 1 }
      })
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ error: 'Subscription failed' });
  }
};
