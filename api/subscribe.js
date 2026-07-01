// Vercel Serverless Function: Newsletter Subscribe via ActiveCampaign
// Nutzt den nativen AC-Form-Endpoint (proc.php), damit der DOI-Flow korrekt ausgeloest wird.
// Flow: 1) GET /f/1 → CSRF-Token holen. 2) POST proc.php → AC schickt DOI-Mail (Campaign 6).
// Kontakt landet als status=0 (pending) → Automation 2 feuert erst nach DOI-Bestaetigung.

const AC_FORM_URL = 'https://krisstelljes3.activehosted.com/f/1';
const AC_PROC_URL = 'https://krisstelljes3.activehosted.com/proc.php';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://krisstelljes.de');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, firstName, website } = req.body || {};

  // Honeypot gegen Bots: Das echte Formular sendet immer ein leeres Feld "website".
  // Bots fuellen es aus oder lassen es ganz weg. In beiden Faellen tun wir so, als
  // haette es geklappt (200), legen aber KEINEN Kontakt an und loesen keine DOI-Mail aus.
  if (typeof website !== 'string' || website.trim() !== '') {
    console.warn('Honeypot ausgeloest, Anmeldung verworfen:', { email, firstName });
    return res.status(200).json({ success: true });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // 1. Formular-Seite laden → CSRF-Token (or) + Session-Cookie extrahieren
    const formRes = await fetch(AC_FORM_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; newsletter-signup/1.0)' }
    });
    const html = await formRes.text();

    // CSRF-Token aus dem Hidden-Field name="or"
    const orMatch = html.match(/name="or"\s+value="([^"]+)"/);
    const orValue = orMatch ? orMatch[1] : '';

    // Session-Cookie weiterleiten (PHPSESSID + cmp-Cookie)
    const rawCookies = formRes.headers.get('set-cookie') || '';
    const cookieHeader = rawCookies
      .split(/,(?=\s*\w+=)/)
      .map(c => c.split(';')[0].trim())
      .join('; ');

    // 2. Formular via proc.php einreichen → DOI-Mail wird ausgeloest
    // field[1]=de ist Pflichtfeld (Bevorzugte Sprache, required im Formular)
    // firstname = AC-Systemfeld fuer Vorname (verifiziert: speichert firstName korrekt)
    const formData = new URLSearchParams({
      u: '1',
      f: '1',
      s: '',
      c: '0',
      m: '0',
      act: 'sub',
      v: '2',
      or: orValue,
      email: email,
      'field[1]': 'de',
      firstname: firstName || ''
    });

    const submitRes = await fetch(AC_PROC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://krisstelljes3.activehosted.com',
        'Referer': AC_FORM_URL,
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (compatible; newsletter-signup/1.0)'
      },
      body: formData.toString(),
      redirect: 'manual'
    });

    const location = submitRes.headers.get('location') || '';

    // Erfolg: AC leitet auf die Danke-/Bestaetigung-URL weiter
    if (location.includes('confirmed') || location.includes('krisstelljes.de')) {
      return res.status(200).json({ success: true });
    }

    // Fehlschlag: AC leitet zurueck zum Formular (Validierungsfehler)
    console.error('proc.php redirect:', location, 'status:', submitRes.status);
    return res.status(500).json({ error: 'Subscription failed (validation)' });

  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ error: 'Subscription failed' });
  }
};
