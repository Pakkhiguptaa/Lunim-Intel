// ─── Lunim Intel - Competitor Intelligence Dashboard ───
// Powered by Tavily Search + GitHub Models (GPT-4o) Summarization

// Keys are now stored in and loaded from localStorage to avoid hardcoding on GitHub.

const DEFAULT_PROMPT = `Identify the top 20 competitors for Lunim — a creative technology company — across these four spaces:

1. Film Community & Entertainment Networking (e.g. Stage32, Coverfly, The Black List)
2. UX Consulting & Design Thinking (e.g. IDEO, Frog Design, Fjord/Accenture Song)
3. AI Studio & Video Generation (e.g. Runway, Pika, Synthesia, HeyGen)
4. AI Education & Online Learning (e.g. Coursera, Udemy, Skillshare, MasterClass)

For each competitor return a JSON array of objects with:
- "name": company name
- "space": which of the 4 spaces they belong to
- "query": a Tavily web-search query to find their latest 2026 news, funding, product launches, or partnerships

Return ONLY the JSON array, no markdown, no explanation.`;

// Space color palette for dynamic competitor cards
const SPACE_COLORS = {
  'Film Community & Entertainment Networking': '#e11d48',
  'UX Consulting & Design Thinking': '#10b981',
  'AI Studio & Video Generation': '#7c3aed',
  'AI Education & Online Learning': '#2563eb',
};
const SPACE_COLORS_ARRAY = ['#e11d48', '#2563eb', '#10b981', '#7c3aed', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6'];

// ─── DOM References ───
const listElement = document.getElementById('intelligence-list');
const refreshBtn = document.getElementById('refresh-action');
const tavilyInput = document.getElementById('tavily-key');
const githubInput = document.getElementById('github-key');
const statusDot = document.getElementById('api-status-dot');
const statusText = document.getElementById('api-status-text');
const promptTextarea = document.getElementById('intelligence-prompt');
const competitorGrid = document.getElementById('competitor-grid');
const signalCountBadge = document.getElementById('signal-count-badge');
const competitorCountBadge = document.getElementById('competitor-count-badge');
const resetPromptBtn = document.getElementById('reset-prompt');

// ─── Pre-fill API keys from LocalStorage ───
if (tavilyInput) tavilyInput.value = localStorage.getItem('tavily-key') || '';
if (githubInput) githubInput.value = localStorage.getItem('github-key') || '';

// ─── Pre-fill prompt from LocalStorage or use default ───
if (promptTextarea) {
  const savedPrompt = localStorage.getItem('intelligence-prompt');
  if (savedPrompt) promptTextarea.value = savedPrompt;
}

// Save prompt changes to LocalStorage
if (promptTextarea) {
  promptTextarea.addEventListener('input', () => {
    localStorage.setItem('intelligence-prompt', promptTextarea.value);
  });
}

// Reset prompt button
if (resetPromptBtn) {
  resetPromptBtn.addEventListener('click', () => {
    promptTextarea.value = DEFAULT_PROMPT;
    localStorage.removeItem('intelligence-prompt');
  });
}

// ─── Render Signals ───
function renderSignals(data) {
  listElement.innerHTML = '';
  data.forEach((signal, index) => {
    const item = document.createElement('div');
    item.className = 'signal-item';
    item.style.animationDelay = `${index * 0.06}s`;
    item.style.opacity = '0';

    const isLive = signal.time === 'Live Now';
    const isError = signal.time === 'Error';
    const isDiscovery = signal.time === 'Discovery';

    item.innerHTML = `
      <div class="signal-time">
        <span class="signal-dot ${isLive ? 'dot-live' : isError ? 'dot-error' : isDiscovery ? 'dot-discovery' : 'dot-cached'}"></span>
        ${signal.time.toUpperCase()} • ${signal.company.toUpperCase()}
      </div>
      <div class="one-line-summary">${signal.summary}</div>
    `;
    listElement.appendChild(item);
  });

  // Update signal count badge
  if (signalCountBadge) {
    signalCountBadge.textContent = `${data.length} Signal${data.length !== 1 ? 's' : ''}`;
  }
}

// ─── Render Competitor Cards Dynamically ───
function renderCompetitorCards(competitors) {
  competitorGrid.innerHTML = '';
  competitors.forEach((comp, index) => {
    const colorKey = Object.keys(SPACE_COLORS).find(k =>
      comp.space && comp.space.toLowerCase().includes(k.toLowerCase().split(' ')[0].toLowerCase())
    );
    const color = colorKey
      ? SPACE_COLORS[colorKey]
      : SPACE_COLORS_ARRAY[index % SPACE_COLORS_ARRAY.length];

    const card = document.createElement('div');
    card.className = 'comp-card';
    card.style.animationDelay = `${index * 0.05}s`;
    card.style.opacity = '0';
    card.style.animation = `fadeIn 0.4s ease forwards ${index * 0.05}s`;

    // Determine short space label
    const spaceLabel = comp.space || 'Unknown';
    const shortSpace = spaceLabel.length > 25 ? spaceLabel.substring(0, 22) + '…' : spaceLabel;

    card.innerHTML = `
      <div class="comp-info">
        <div class="comp-logo" style="background: ${color};">${comp.name.charAt(0)}</div>
        <div class="comp-meta">
          <h3>${comp.name}</h3>
          <p>${shortSpace}</p>
        </div>
      </div>
      <div class="comp-status">
        <span class="tag" style="background: ${color}22; color: ${color};">${comp.status || 'Discovered'}</span>
      </div>
    `;
    competitorGrid.appendChild(card);
  });

  // Update competitor count badge
  if (competitorCountBadge) {
    competitorCountBadge.textContent = `${competitors.length} Found`;
  }
}

// ─── Update API Status Indicator ───
function setApiStatus(state, customText) {
  if (!statusDot || !statusText) return;
  statusDot.className = 'status-dot';
  switch (state) {
    case 'connected':
      statusDot.classList.add('status-connected');
      statusText.textContent = customText || 'APIs Connected';
      break;
    case 'partial':
      statusDot.classList.add('status-partial');
      statusText.textContent = customText || 'Partial (Tavily only)';
      break;
    case 'disconnected':
      statusDot.classList.add('status-disconnected');
      statusText.textContent = customText || 'No API Keys';
      break;
    case 'working':
      statusDot.classList.add('status-working');
      statusText.textContent = customText || 'Fetching...';
      break;
  }
}

function checkApiStatus() {
  const hasTavily = tavilyInput && tavilyInput.value.trim().length > 0;
  const hasGithub = githubInput && githubInput.value.trim().length > 0;
  if (hasTavily && hasGithub) {
    setApiStatus('connected');
  } else if (hasTavily) {
    setApiStatus('partial');
  } else {
    setApiStatus('disconnected');
  }
}

// ─── LLM Call (GitHub Models GPT-4o) ───
async function callLLM(systemPrompt, userPrompt, maxTokens = 2000) {
  const token = githubInput ? githubInput.value.trim() : '';
  if (!token) throw new Error('LLM API Key (GitHub Token) is required for competitor discovery.');

  const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Tavily Search ───
async function fetchTavilySearch(query) {
  const apiKey = tavilyInput.value.trim();
  if (!apiKey) throw new Error('Tavily API key is missing');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 3
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tavily API Error (${response.status}): ${errorBody}`);
  }
  return await response.json();
}

// ─── Summarize with GPT-4o ───
async function summarizeWithGPT4o(rawText, companyName) {
  try {
    const result = await callLLM(
      'You are a competitive intelligence analyst. Write a concise, one-line press summary (max 40 words) focusing on the most important recent development. Be specific with names, numbers, and dates.',
      `Summarize the latest press intelligence for ${companyName}:\n\n${rawText}`,
      80
    );
    return result || rawText.substring(0, 250);
  } catch (err) {
    console.warn('GPT-4o summarization error:', err);
    return rawText.substring(0, 250);
  }
}

// ─── Progress rendering ───
function showProgress(message, subMessage) {
  listElement.innerHTML = `
    <div class="signal-item loading-pulse">
      <div class="signal-time">
        <span class="signal-dot dot-working"></span>
        ${message}
      </div>
      <div class="one-line-summary">${subMessage || ''}</div>
    </div>
  `;
}

// ─── Main Refresh Handler ───
async function handleRefresh() {
  refreshBtn.classList.add('loading');
  refreshBtn.disabled = true;
  setApiStatus('working', 'Discovering...');

  const prompt = promptTextarea ? promptTextarea.value.trim() : DEFAULT_PROMPT;

  try {
    // ═══════════ STEP 1: LLM discovers competitors ═══════════
    showProgress('STEP 1 — DISCOVERING COMPETITORS...', 'Sending your prompt to the LLM to identify competitors...');

    const llmResponse = await callLLM(
      'You are a market research analyst. You MUST respond with ONLY a valid JSON array. No markdown fences, no explanations. Each object must have "name", "space", and "query" keys.',
      prompt,
      3000
    );

    // Parse the JSON response
    let competitors;
    try {
      // Strip potential markdown fencing
      let cleaned = llmResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      competitors = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Failed to parse LLM competitor list. Raw response: ${llmResponse.substring(0, 300)}`);
    }

    if (!Array.isArray(competitors) || competitors.length === 0) {
      throw new Error('LLM returned an empty or invalid competitor list.');
    }

    // Show discovered competitors in the grid
    renderCompetitorCards(competitors);

    // Show discovery signals
    const discoverySignals = competitors.map(c => ({
      company: c.name,
      summary: `Discovered in "${c.space}" — search query: "${c.query}"`,
      time: 'Discovery'
    }));
    renderSignals(discoverySignals);

    // ═══════════ STEP 2: Tavily search for each competitor ═══════════
    showProgress(
      `STEP 2 — SEARCHING ${competitors.length} COMPETITORS...`,
      'Querying Tavily for live press signals on each discovered competitor...'
    );

    const liveSignals = [];
    const updatedCompetitors = [...competitors];

    for (let i = 0; i < competitors.length; i++) {
      const company = competitors[i];
      setApiStatus('working', `Searching ${i + 1}/${competitors.length}...`);

      try {
        const searchResults = await fetchTavilySearch(company.query);

        let rawContent = searchResults.answer || '';
        if (searchResults.results && searchResults.results.length > 0) {
          const snippets = searchResults.results
            .slice(0, 3)
            .map(r => r.content)
            .join(' ');
          rawContent = rawContent ? `${rawContent}\n\nAdditional context:\n${snippets}` : snippets;
        }

        if (!rawContent) {
          rawContent = 'No recent press coverage found.';
        }

        // Step 3: Summarize
        const summary = await summarizeWithGPT4o(rawContent, company.name);

        liveSignals.push({
          company: company.name,
          summary: summary.replace(/\n/g, ' '),
          time: 'Live Now'
        });

        // Update competitor status
        updatedCompetitors[i] = { ...company, status: 'Live' };
      } catch (err) {
        console.error(`Error for ${company.name}:`, err);
        liveSignals.push({
          company: company.name,
          summary: `⚠ ${err.message}`,
          time: 'Error'
        });
        updatedCompetitors[i] = { ...company, status: 'Error' };
      }
    }

    // Final render
    renderSignals(liveSignals);
    renderCompetitorCards(updatedCompetitors);

    // Update last-updated timestamp
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
      const now = new Date();
      lastUpdated.textContent = `LAST UPDATED: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (e) {
    console.error('General Error:', e);
    listElement.innerHTML = `
      <div class="signal-item">
        <div class="signal-time">
          <span class="signal-dot dot-error"></span>
          ERROR
        </div>
        <div class="one-line-summary">⚠ ${e.message}</div>
      </div>
    `;
  } finally {
    refreshBtn.classList.remove('loading');
    refreshBtn.disabled = false;
    checkApiStatus();
  }
}

// ─── Initialization ───
checkApiStatus();

// ─── Event Listeners ───
refreshBtn.addEventListener('click', handleRefresh);

// Update status and save to LocalStorage when keys change
if (tavilyInput) {
  tavilyInput.addEventListener('input', () => {
    localStorage.setItem('tavily-key', tavilyInput.value.trim());
    checkApiStatus();
  });
}
if (githubInput) {
  githubInput.addEventListener('input', () => {
    localStorage.setItem('github-key', githubInput.value.trim());
    checkApiStatus();
  });
}

// Toggle password visibility
document.querySelectorAll('.toggle-visibility').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🔒';
    }
  });
});
