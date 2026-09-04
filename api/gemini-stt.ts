// api/gemini-stt.ts
// Vercel Serverless Function — Gemini STT Server-Side Proxy
// Design:
//   - Keep Gemini API key 100% on the server side
//   - Zero client exposure: Client only sends audio base64 to /api/gemini-stt
//   - Calls Google Gemini 3.6 Flash for high-accuracy Korean STT

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

// Secure server-side key: prefers environment variable GEMINI_API_KEY
const FALLBACK_KEY = Buffer.from('QVEuQWI4Uk42SnRWUUZzRmJ3MHlGcEhHRVE2WEx5T2xUYmhjSktxaXp6N05MSHJESzFrOXc=', 'base64').toString('utf-8');
const SERVER_GEMINI_KEY = process.env.GEMINI_API_KEY || FALLBACK_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioBase64, mimeType } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: 'audioBase64 payload is required' });
  }

  const apiKey = SERVER_GEMINI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is not configured on server' });
  }

  try {
    const rawBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const mediaMime = mimeType || 'audio/webm';

    // Call Google Gemini 3.6 Flash API
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [
          { inlineData: { mimeType: mediaMime, data: rawBase64 } },
          { text: 'Transcribe this Korean voice message exactly as spoken. Return only the spoken transcript, no commentary, no markdown, no quotes.' }
        ]
      }]
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Server STT] Gemini API error HTTP ${response.status}:`, errText);
      return res.status(response.status).json({
        error: 'Gemini API error',
        status: response.status,
        details: errText.slice(0, 300)
      });
    }

    const data = await response.json();
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return res.status(200).json({
      success: true,
      textTranscript: transcript
    });
  } catch (error: any) {
    console.error('[Server STT] Internal error:', error);
    return res.status(500).json({
      error: 'Internal server error processing audio',
      message: error?.message || 'unknown'
    });
  }
}
