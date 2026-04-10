const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Notion-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint, body, method, headers } = req.body;

  try {
    const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
      method: method || 'POST',
      headers: {
        'Authorization': headers.Authorization,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Notion Proxy Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
