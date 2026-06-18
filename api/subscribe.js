// Vercel Serverless Function: Newsletter Subscribe via ActiveCampaign FORM (proc.php)
// Reicht den Eintrag an das AC-Formular (id 1, „Der Wiederaufbau Newsletter Opt-in") weiter.
// Dieses Formular hat Double-Opt-In aktiviert → AC verschickt die Bestätigungsmail nativ.
// (Ersetzt den v3-API-Weg contact/sync + contactLists status=2, der KEINE DOI-Mail auslöst.)

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

  // Versteckte Felder aus dem offiziellen AC-Embed-Code von Formular 1.
  const params = new URLSearchParams();
  params.append('u', '1');
  params.append('f', '1');
  params.append('s', '');
  params.append('c', '0');
  params.append('m', '0');
  params.append('act', 'sub');
  params.append('v', '2');
  params.append('or', '5f8a27e6-dfc8-4b98-afcb-bd9ce8b012e6');
  params.append('email', email);
  if (firstName) params.append('firstname', firstName);

  try {
    const acRes = await fetch('https://krisstelljes3.activehosted.com/proc.php?jsonp=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });
    // AC antwortet mit JSONP; HTTP 200 = angenommen. Inhalt wird nicht benötigt.
    await acRes.text();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ error: 'Subscription failed' });
  }
};
