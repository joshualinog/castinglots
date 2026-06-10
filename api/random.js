function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  let body = req.body;
  if (!body || Object.keys(body).length === 0) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    } catch (error) {
      res.status(400).json({ error: { message: 'Invalid JSON body' } });
      return;
    }
  }

  const min = Number(body.min);
  const max = Number(body.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    res.status(400).json({ error: { message: 'Invalid min/max values' } });
    return;
  }

  const apiKey = process.env.RANDOM_ORG_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'Missing Random.org API key' } });
    return;
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'generateIntegers',
    params: {
      apiKey,
      n: 1,
      min,
      max,
      replacement: true,
      base: 10
    },
    id: Date.now()
  };

  try {
    const response = await fetch('https://api.random.org/json-rpc/4/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    if (!response.ok || json.error) {
      const message = json.error?.message || `Random.org responded with ${response.status}`;
      res.status(502).json({ error: { message } });
      return;
    }

    res.status(200).json(json);
  } catch (error) {
    res.status(502).json({ error: { message: error.message || 'Random.org request failed' } });
  }
}
