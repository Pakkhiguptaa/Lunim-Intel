// ─── Lunim Intel - Competitor Intelligence Dashboard ───
// Powered by Tavily Search + GitHub Models (GPT-4o) Summarization

// Keys are now stored in and loaded from localStorage to avoid hardcoding on GitHub.

const DEFAULT_PROMPT = `You are a competitive intelligence analyst for Lunim — a creative technology company.

Identify the top 20 competitors for Lunim across these four spaces:
1. Film Community & Entertainment Networking (e.g. Stage32, Coverfly, The Black List)
2. UX Consulting & Design Thinking (e.g. IDEO, Frog Design, Fjord/Accenture Song)
3. AI Studio & Video Generation (e.g. Runway, Pika, Synthesia, HeyGen)
4. AI Education & Online Learning (e.g. Coursera, Udemy, Skillshare, MasterClass)

For each competitor return a JSON array of objects with:
- "name": company name
- "space": which of the 4 spaces they belong to (use short labels: "Film & Entertainment", "UX & Design", "AI Video & Studio", "AI Education")
- "query": a Tavily web-search query to find their latest 2026 news, funding, product launches, or partnerships

Return ONLY the JSON array, no markdown, no explanation.`;

// Space color palette
const SPACE_COLORS = {
  'film': '#e11d48',
  'ux': '#10b981',
  'ai video': '#7c3aed',
  'ai education': '#2563eb',
};

function getSpaceColor(space) {
  if (!space) return '#6366f1';
  const s = space.toLowerCase();
  if (s.includes('film') || s.includes('entertainment')) return SPACE_COLORS['film'];
  if (s.includes('ux') || s.includes('design')) return SPACE_COLORS['ux'];
  if (s.includes('video') || s.includes('studio') || s.includes('generat')) return SPACE_COLORS['ai video'];
  if (s.includes('education') || s.includes('learning')) return SPACE_COLORS['ai education'];
  return '#6366f1';
}

// Trend tag classes
const TREND_CLASSES = {
  'trending': 'tag-trending',
  'high growth': 'tag-high-growth',
  'growing': 'tag-trending',
  'steady': 'tag-steady',
  'stagnant': 'tag-stagnant',
  'declining': 'tag-declining',
  'emerging': 'tag-emerging',
};

function getTrendClass(trend) {
  if (!trend) return 'tag-steady';
  const t = trend.toLowerCase();
  for (const [key, cls] of Object.entries(TREND_CLASSES)) {
    if (t.includes(key)) return cls;
  }
  return 'tag-steady';
}

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

// ─── Render Signals (with source links) ───
function renderSignals(data) {
  listElement.innerHTML = '';
  data.forEach((signal, index) => {
    const item = document.createElement('div');
    item.className = 'signal-item';
    item.style.animationDelay = `${index * 0.05}s`;
    item.style.opacity = '0';

    const isLive = signal.time === 'Live Now';
    const isError = signal.time === 'Error';

    // Build source links HTML
    let sourcesHtml = '';
    if (signal.sources && signal.sources.length > 0) {
      const links = signal.sources.slice(0, 3).map((src, i) => {
        const domain = new URL(src.url).hostname.replace('www.', '');
        const title = src.title ? src.title.substring(0, 40) : domain;
        return `<a href="${src.url}" target="_blank" rel="noopener" class="source-link" title="${src.title || src.url}">${title}${src.title && src.title.length > 40 ? '…' : ''}</a>`;
      }).join('');
      sourcesHtml = `<div class="signal-sources">${links}</div>`;
    }

    item.innerHTML = `
      <div class="signal-time">
        <span class="signal-dot ${isLive ? 'dot-live' : isError ? 'dot-error' : 'dot-cached'}"></span>
        ${signal.time.toUpperCase()} • ${signal.company.toUpperCase()}
      </div>
      <div class="one-line-summary">${signal.summary}</div>
      ${sourcesHtml}
    `;
    listElement.appendChild(item);
  });

  if (signalCountBadge) {
    signalCountBadge.textContent = `${data.length} Signal${data.length !== 1 ? 's' : ''}`;
  }
}

// ─── Render Competitor Cards (rich version with trend, summary, sources) ───
function renderCompetitorCards(competitors) {
  competitorGrid.innerHTML = '';
  competitors.forEach((comp, index) => {
    const color = getSpaceColor(comp.space);
    const trendClass = getTrendClass(comp.trend);
    const trendLabel = comp.trend || 'Pending';

    const card = document.createElement('div');
    card.className = 'comp-card';
    card.style.animation = `fadeIn 0.4s ease forwards ${index * 0.04}s`;

    // Short space label
    const spaceLabel = comp.space || 'Unknown';

    // Build summary
    const summary = comp.summary || '';

    // Build source links
    let sourcesHtml = '';
    if (comp.sources && comp.sources.length > 0) {
      const links = comp.sources.slice(0, 2).map(src => {
        const domain = new URL(src.url).hostname.replace('www.', '');
        return `<a href="${src.url}" target="_blank" rel="noopener" class="source-chip" title="${src.title || src.url}">🔗 ${domain}</a>`;
      }).join('');
      sourcesHtml = `<div class="comp-sources">${links}</div>`;
    }

    card.innerHTML = `
      <div class="comp-info">
        <div class="comp-logo" style="background: ${color};">${comp.name.charAt(0)}</div>
        <div class="comp-meta">
          <h3>${comp.name}</h3>
          <p>${spaceLabel}</p>
        </div>
        <span class="tag ${trendClass}" style="margin-left: auto;">${trendLabel}</span>
      </div>
      ${summary ? `<p class="comp-summary">${summary}</p>` : ''}
      ${sourcesHtml}
    `;
    competitorGrid.appendChild(card);
  });

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
  if (!token) throw new Error('LLM API Key (GitHub Token) is required.');

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
      max_results: 5
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tavily API Error (${response.status}): ${errorBody}`);
  }
  return await response.json();
}

// ─── Analyze competitor: LLM reads Tavily results and returns structured analysis ───
async function analyzeCompetitor(rawContent, companyName, sources) {
  const token = githubInput ? githubInput.value.trim() : '';
  if (!token) {
    return {
      summary: rawContent.substring(0, 200),
      trend: 'Unknown'
    };
  }

  try {
    const result = await callLLM(
      `You are a competitive intelligence analyst writing for a strategy team. You MUST respond with ONLY valid JSON, no markdown fences. Analyze the press coverage and return a JSON object with:
- "summary": A concise 1-2 sentence actionable summary (max 50 words) of what the press is saying — include specific product names, funding rounds, revenue numbers, partnerships, or launches. Be specific, not generic.
- "trend": One of exactly these labels based on what the press signals indicate: "Trending" (strong positive momentum, new launches, big funding), "High Growth" (rapid expansion, major deals), "Steady" (stable, incremental progress), "Emerging" (new entrant, early stage), "Stagnant" (low activity, no major news), "Declining" (layoffs, losses, negative press)

Return ONLY the JSON object.`,
      `Analyze the latest press intelligence for ${companyName}:\n\n${rawContent}`,
      150
    );

    let parsed;
    try {
      let cleaned = result.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return { summary: result.substring(0, 200), trend: 'Steady' };
    }

    return {
      summary: parsed.summary || rawContent.substring(0, 200),
      trend: parsed.trend || 'Steady'
    };
  } catch (err) {
    console.warn(`Analysis error for ${companyName}:`, err);
    return { summary: rawContent.substring(0, 200), trend: 'Unknown' };
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
    showProgress('STEP 1 / 3 — DISCOVERING COMPETITORS...', 'Sending your prompt to the LLM to identify the top competitors...');

    const llmResponse = await callLLM(
      'You are a market research analyst. You MUST respond with ONLY a valid JSON array. No markdown fences, no explanations. Each object must have "name", "space", and "query" keys.',
      prompt,
      3000
    );

    // Parse JSON
    let competitors;
    try {
      let cleaned = llmResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      competitors = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Failed to parse LLM competitor list. Raw: ${llmResponse.substring(0, 300)}`);
    }

    if (!Array.isArray(competitors) || competitors.length === 0) {
      throw new Error('LLM returned an empty or invalid competitor list.');
    }

    // Show initial competitor cards (pending state)
    renderCompetitorCards(competitors.map(c => ({ ...c, trend: 'Pending', summary: '' })));

    // ═══════════ STEP 2: Tavily search each competitor ═══════════
    showProgress(
      `STEP 2 / 3 — SEARCHING PRESS FOR ${competitors.length} COMPETITORS...`,
      'Querying Tavily for live press coverage on each competitor...'
    );

    const enrichedCompetitors = [];
    const liveSignals = [];

    for (let i = 0; i < competitors.length; i++) {
      const company = competitors[i];
      setApiStatus('working', `Searching ${i + 1}/${competitors.length}: ${company.name}`);

      try {
        const searchResults = await fetchTavilySearch(company.query);

        // Collect raw content
        let rawContent = searchResults.answer || '';
        const sources = [];

        if (searchResults.results && searchResults.results.length > 0) {
          searchResults.results.slice(0, 5).forEach(r => {
            sources.push({ url: r.url, title: r.title || '' });
          });
          const snippets = searchResults.results
            .slice(0, 4)
            .map(r => r.content)
            .join('\n');
          rawContent = rawContent ? `${rawContent}\n\nPress snippets:\n${snippets}` : snippets;
        }

        if (!rawContent) rawContent = 'No recent press coverage found.';

        // ═══════════ STEP 3: LLM analyses & summarises ═══════════
        if (i === 0) {
          showProgress(
            `STEP 3 / 3 — ANALYSING PRESS & ASSIGNING TRENDS...`,
            `LLM is reading press for ${company.name} and ${competitors.length - 1} more...`
          );
        }

        const analysis = await analyzeCompetitor(rawContent, company.name, sources);

        enrichedCompetitors.push({
          ...company,
          summary: analysis.summary,
          trend: analysis.trend,
          sources: sources
        });

        liveSignals.push({
          company: company.name,
          summary: analysis.summary,
          time: 'Live Now',
          sources: sources
        });

        // Update cards progressively
        const pendingRemaining = competitors.slice(i + 1).map(c => ({ ...c, trend: 'Pending', summary: '' }));
        renderCompetitorCards([...enrichedCompetitors, ...pendingRemaining]);

      } catch (err) {
        console.error(`Error for ${company.name}:`, err);
        enrichedCompetitors.push({
          ...company,
          summary: `⚠ ${err.message}`,
          trend: 'Unknown',
          sources: []
        });
        liveSignals.push({
          company: company.name,
          summary: `⚠ ${err.message}`,
          time: 'Error',
          sources: []
        });
      }
    }

    // Final render
    renderCompetitorCards(enrichedCompetitors);
    renderSignals(liveSignals);

    // Update timestamp
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
