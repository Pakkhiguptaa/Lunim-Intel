const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Notion proxy — bypasses browser CORS restrictions
app.post('/api/notion', async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`Lunim Intel running on port ${PORT}`);
});
