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

    // Email HTML — keep short since ICS attachment shows the details
    const swathiHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <p>Hi Swathi,</p>
        <p>A new appointment has been requested by <strong>${name}</strong> (${email}).</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>Please review the calendar invite attached and Accept or Decline.</p>
        <p style="font-size:13px;color:#888;">— Progressive Financial Services</p>
      </div>`;

    const clientHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <p>Hi ${name},</p>
        <p>Thank you for booking an appointment with Progressive Financial Services!</p>
        <p>Please review the calendar invite attached and click <strong>Accept</strong> to confirm.</p>
        ${notes ? `<p><strong>Your notes:</strong> ${notes}</p>` : ''}
        <p>If you have questions, reply to this email or call +1 (609) 751-1089.</p>
        <p style="font-size:13px;color:#888;">— Swathi Nalluri, Progressive Financial Services</p>
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
          html: swathiHtml,
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
          html: clientHtml,
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
