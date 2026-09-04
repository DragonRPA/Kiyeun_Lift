import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cloudflare Workers AI STT Endpoint
// Uses @cf/openai/whisper (10,000 Neurons/day 100% Free on Cloudflare)
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '35014a2514680107d74e1e68d96e6c32';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || Buffer.from('Y2Z1dF9sOTBRY1d6aHBqSzM3b0VzTXlZZld3VjNySTlJc21CZlprYlp4OVRGMDBiZjkxMDg=', 'base64').toString('utf-8');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { audioBase64 } = req.body || {};
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Missing audioBase64' });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.length < 200) {
      return res.status(200).json({ textTranscript: '' });
    }

    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/openai/whisper`;
    const cfResponse = await fetch(cfEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!cfResponse.ok) {
      const errText = await cfResponse.text();
      console.error('[Cloudflare Workers AI STT] Error HTTP', cfResponse.status, errText);
      return res.status(cfResponse.status).json({
        error: 'Cloudflare AI error',
        details: errText
      });
    }

    const data = (await cfResponse.json()) as any;
    const textTranscript = (data?.result?.text || '').trim();

    return res.status(200).json({
      textTranscript,
      success: true
    });
  } catch (error: any) {
    console.error('[Cloudflare Workers AI STT] Exception:', error);
    return res.status(500).json({
      error: error?.message || 'Internal Server Error'
    });
  }
}
