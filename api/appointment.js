// Vercel Serverless Function — sends calendar invite emails via Resend
// Both Swathi and the client receive a proper calendar invite with Accept/Decline

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, subject, date, time, notes } = req.body;

    if (!name || !email || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SWATHI_EMAIL = 'swathisurya@progressivefinserv.com';
    const ZOOM_LINK = 'https://us06web.zoom.us/j/84404141315?pwd=Fr8paj2dXzS1KECjXArf9cacaTnYjz.1';

    // Build date objects
    const startDate = new Date(`${date}T${time}:00`);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const prettyDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });

    // Generate ICS content
    const icsContent = generateICS({
      summary: `${subject || 'Consultation'} — Progressive Financial Services`,
      description: notes || '',
      location: ZOOM_LINK,
      start: startDate,
      end: endDate,
      organizerEmail: SWATHI_EMAIL,
      organizerName: 'Swathi Nalluri',
      attendeeEmail: email,
      attendeeName: name,
      zoomLink: ZOOM_LINK
    });

    // Base64 encode the ICS for attachment
    const icsBase64 = Buffer.from(icsContent).toString('base64');

    // Email HTML template — detailed for both parties
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#4A3AFF,#00B4A6);padding:24px;border-radius:12px 12px 0 0;color:#fff;">
          <h2 style="margin:0;font-size:22px;">📅 Appointment Confirmation</h2>
          <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Progressive Financial Services</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e8e8e8;border-top:0;border-radius:0 0 12px 12px;">
          <table style="width:100%;font-size:14px;line-height:1.8;">
            <tr><td style="color:#666;width:100px;">👤 Client</td><td><strong>${name}</strong> (${email})</td></tr>
            <tr><td style="color:#666;">📋 Subject</td><td>${subject || 'Consultation'}</td></tr>
            <tr><td style="color:#666;">📅 Date</td><td><strong>${prettyDate}</strong></td></tr>
            <tr><td style="color:#666;">⏱️ Duration</td><td>30 minutes</td></tr>
            <tr><td style="color:#666;">📍 Location</td><td>Zoom Meeting</td></tr>
          </table>
          <div style="margin:20px 0;padding:16px;background:#f5f3ff;border-radius:8px;border-left:4px solid #4A3AFF;">
            <strong style="font-size:14px;">🔗 Zoom Meeting</strong><br>
            <a href="${ZOOM_LINK}" style="color:#4A3AFF;font-size:13px;">Join Meeting</a><br>
            <span style="font-size:12px;color:#666;">Meeting ID: 844 0414 1315 · Passcode: 178541</span>
          </div>
          ${notes ? `<div style="margin:16px 0;"><strong>📝 Notes:</strong><br><span style="color:#555;">${notes}</span></div>` : ''}
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">
            Progressive Financial Services · 32 Cinder Rd Unit 20, Edison, NJ 08820<br>
            +1 (609) 751-1089 · swathisurya@progressivefinserv.com
          </p>
        </div>
      </div>`;

    // Send to BOTH Swathi and the client with calendar invite attachment
    const results = await Promise.all([
      // Email to Swathi
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Progressive Financial <appointments@progressivefinserv.com>',
          to: SWATHI_EMAIL,
          reply_to: email,
          subject: `📅 New Appointment: ${subject || 'Consultation'} — ${prettyDate}`,
          html: emailHtml,
          attachments: [{
            filename: 'appointment.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST'
          }]
        })
      }),
      // Email to Client
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Progressive Financial <appointments@progressivefinserv.com>',
          to: email,
          reply_to: SWATHI_EMAIL,
          subject: `📅 Your Appointment — Progressive Financial Services — ${prettyDate}`,
          html: emailHtml,
          attachments: [{
            filename: 'appointment.ics',
            content: icsBase64,
            content_type: 'text/calendar; method=REQUEST'
          }]
        })
      })
    ]);

    const [swathiRes, clientRes] = results;
    const swathiOk = swathiRes.ok;
    const clientOk = clientRes.ok;

    if (!swathiOk) console.error('Swathi email failed:', await swathiRes.text());
    if (!clientOk) console.error('Client email failed:', await clientRes.text());

    return res.status(200).json({
      success: swathiOk || clientOk,
      swathiSent: swathiOk,
      clientSent: clientOk,
      date: prettyDate
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function generateICS({ summary, description, location, start, end, organizerEmail, organizerName, attendeeEmail, attendeeName, zoomLink }) {
  const pad = (n) => String(n).padStart(2, '0');
  const toICS = (d) => d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';

  const uid = Date.now() + '-' + Math.random().toString(36).substr(2,9) + '@progressivefinserv.com';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Progressive Financial Services//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + toICS(new Date()),
    'DTSTART:' + toICS(start),
    'DTEND:' + toICS(end),
    'SUMMARY:' + summary,
    'LOCATION:' + location,
    'URL:' + zoomLink,
    'TRANSP:OPAQUE',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
    'X-GOOGLE-CONFERENCE:' + zoomLink
  ];

  // Only add description if there are notes
  if (description) {
    lines.push('DESCRIPTION:' + description.replace(/\n/g, '\\n'));
  }

  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n');
}
