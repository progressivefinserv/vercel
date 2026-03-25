# Progressive Financial — Appointment API

Serverless API endpoint (Vercel + Resend) that sends calendar invite emails with Accept/Decline.

## Setup (one-time, 5 minutes)

### 1. Resend (email service)
1. Go to [resend.com](https://resend.com) → Sign up (free: 3,000 emails/month)
2. Add your domain: **Domains → Add Domain → progressivefinserv.com**
3. Add the DNS records Resend gives you (DKIM, SPF, etc.)
4. Go to **API Keys → Create API Key** → copy it

### 2. Vercel (hosting)
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **New Project → Import** this repository
3. In **Environment Variables**, add:
   - `RESEND_API_KEY` = your Resend API key
4. Click **Deploy**
5. Note your deployment URL (e.g., `https://your-project.vercel.app`)

### 3. Update the website
Replace the API URL in your website's form submission code:
```
const API_URL = 'https://your-project.vercel.app/api/appointment';
```

## How it works
- Form submits → calls Vercel API
- API generates ICS calendar invite
- Resend sends to BOTH Swathi and the client
- Email arrives with `.ics` attachment → shows Accept/Decline in Zoho, Gmail, Outlook
- Beautiful HTML email template with all appointment details + Zoom link

## API Endpoint
```
POST /api/appointment
Body: { name, email, subject, date, time, notes }
Response: { success, swathiSent, clientSent, date }
```
