const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Inject environment variables into index.html
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const defaults = `<script>
    window.LUNIM_DEFAULTS = {
      notionKey: "${process.env.NOTION_KEY || ''}",
      notionPageId: "${process.env.NOTION_PAGE_ID || ''}",
      notionDbId: "${process.env.NOTION_DB_ID || ''}"
    };
  </script>`;
  html = html.replace('</head>', `${defaults}\n</head>`);
  res.send(html);
});

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
