// ─── Lunim Intel - Competitor Intelligence Dashboard ───
// Powered by Tavily Search + GitHub Models (GPT-4o) Summarization
// Keys stored in localStorage, protected by password on UI

const KEYS_PASSWORD = 'Coffee';

// ─── HARDCODED COMPANY PROFILE (immutable) ───
// This context is ALWAYS injected into every intelligence search.
// It cannot be edited from the UI — it defines who Lunim is.
const LUNIM_PROFILE = Object.freeze({
  name: 'Lunim',
  industry: 'AI and Web3',
  description: 'Lunim is a tech company operating at the intersection of AI and Web3.',
  pillars: [
    { id: 1, name: 'Film Community & Entertainment Networking', shortLabel: 'Film & Entertainment', examples: 'Stage32, Coverfly, The Black List, FilmFreeway, Seed&Spark' },
    { id: 2, name: 'UX Consulting & Design Thinking', shortLabel: 'UX & Design', examples: 'IDEO, Frog Design, Fjord/Accenture Song, Huge, Pentagram' },
    { id: 3, name: 'AI Studio & Video Generation', shortLabel: 'AI Video & Studio', examples: 'Runway, Pika, Synthesia, HeyGen, Luma AI, Kling' },
    { id: 4, name: 'AI Education & Online Learning', shortLabel: 'AI Education', examples: 'Coursera, Udemy, Skillshare, MasterClass, DataCamp' }
  ]
});

// This is the immutable system context that always gets injected.
// The editable prompt in the UI is layered ON TOP of this.
const LUNIM_CONTEXT_INJECTION = `
== COMPANY CONTEXT (hardcoded — always active) ==
Company: ${LUNIM_PROFILE.name}
Industry: ${LUNIM_PROFILE.industry}
Description: ${LUNIM_PROFILE.description}

Lunim's Four Pillars of Work:
${LUNIM_PROFILE.pillars.map(p => `${p.id}. ${p.name} (e.g. ${p.examples})`).join('\n')}

When identifying competitors, you MUST select companies from the ${LUNIM_PROFILE.industry} space
and related industries that overlap with the four pillars above.
Use short space labels: ${LUNIM_PROFILE.pillars.map(p => `"${p.shortLabel}"`).join(', ')}
== END COMPANY CONTEXT ==
`.trim();

// The DEFAULT_PROMPT is the editable part — departments can customize this.
// The LUNIM_CONTEXT_INJECTION is always prepended automatically.
const DEFAULT_PROMPT = `Identify latest press signals on the top 20 competitors for Lunim across its four pillars of work.

For each competitor return a JSON array of objects with:
- "name": company name
- "space": which of the 4 pillars they belong to (use short labels: "Film & Entertainment", "UX & Design", "AI Video & Studio", "AI Education")
- "query": a Tavily web-search query to find their latest 2026 news, funding, product launches, or partnerships

Return ONLY the JSON array, no markdown, no explanation.`;

// ─── Space colors ───
function getSpaceColor(space) {
  if (!space) return '#6366f1';
  const s = space.toLowerCase();
  if (s.includes('film') || s.includes('entertainment')) return '#e11d48';
  if (s.includes('ux') || s.includes('design')) return '#10b981';
  if (s.includes('video') || s.includes('studio') || s.includes('generat')) return '#7c3aed';
  if (s.includes('education') || s.includes('learning')) return '#2563eb';
  return '#6366f1';
}

// ─── Trend classes ───
function getTrendClass(trend) {
  if (!trend) return 'tag-steady';
  const t = trend.toLowerCase();
  if (t.includes('trending')) return 'tag-trending';
  if (t.includes('high growth') || t.includes('growing')) return 'tag-high-growth';
  if (t.includes('stagnant')) return 'tag-stagnant';
  if (t.includes('declining') || t.includes('decline')) return 'tag-declining';
  if (t.includes('emerging')) return 'tag-emerging';
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

// Password elements
const keysLockScreen = document.getElementById('keys-lock-screen');
const keysUnlocked = document.getElementById('keys-unlocked');
const keysPasswordInput = document.getElementById('keys-password');
const keysUnlockBtn = document.getElementById('keys-unlock-btn');
const keysLockHint = document.getElementById('keys-lock-hint');

// ─── Password Protection for API Keys ───
keysUnlockBtn.addEventListener('click', attemptUnlock);
keysPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptUnlock();
});

function attemptUnlock() {
  const entered = keysPasswordInput.value.trim();
  if (entered === KEYS_PASSWORD) {
    keysLockScreen.style.display = 'none';
    keysUnlocked.style.display = 'block';
    keysLockHint.textContent = '';
  } else {
    keysLockHint.textContent = '✕ Wrong password';
    keysPasswordInput.value = '';
    keysPasswordInput.focus();
  }
}

// ─── Pre-fill API keys from LocalStorage ───
if (tavilyInput) tavilyInput.value = localStorage.getItem('tavily-key') || '';
if (githubInput) githubInput.value = localStorage.getItem('github-key') || '';

// ─── Pre-fill prompt from LocalStorage or use default ───
if (promptTextarea) {
  const savedPrompt = localStorage.getItem('intelligence-prompt');
  if (savedPrompt) promptTextarea.value = savedPrompt;
}

if (promptTextarea) {
  promptTextarea.addEventListener('input', () => {
    localStorage.setItem('intelligence-prompt', promptTextarea.value);
  });
}

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
    item.style.animationDelay = `${index * 0.04}s`;

    const isLive = signal.time === 'Live Now';
    const isError = signal.time === 'Error';

    let sourcesHtml = '';
    if (signal.sources && signal.sources.length > 0) {
      const links = signal.sources.slice(0, 3).map(src => {
        try {
          const domain = new URL(src.url).hostname.replace('www.', '');
          return `<a href="${src.url}" target="_blank" rel="noopener" class="source-link" title="${src.title || ''}">${domain}</a>`;
        } catch { return ''; }
      }).filter(Boolean).join('');
      if (links) sourcesHtml = `<div class="signal-sources">${links}</div>`;
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

// ─── Render Competitor Cards (logo + trend) ───
function renderCompetitorCards(competitors) {
  competitorGrid.innerHTML = '';
  competitors.forEach((comp, index) => {
    const color = getSpaceColor(comp.space);
    const trendClass = getTrendClass(comp.trend);
    const trendLabel = comp.trend || 'Pending';

    const card = document.createElement('div');
    card.className = 'comp-card';
    card.style.animationDelay = `${index * 0.03}s`;

    card.innerHTML = `
      <div class="comp-logo" style="background: ${color};">${comp.name.charAt(0)}</div>
      <span class="comp-name">${comp.name}</span>
      <span class="comp-space">${comp.space || ''}</span>
      <div class="comp-trend">
        <span class="tag ${trendClass}">${trendLabel}</span>
      </div>
    `;
    competitorGrid.appendChild(card);
  });

  if (competitorCountBadge) {
    competitorCountBadge.textContent = `${competitors.length} Found`;
  }
}

// ─── API Status ───
function setApiStatus(state, customText) {
  if (!statusDot || !statusText) return;
  statusDot.className = 'status-dot';
  switch (state) {
    case 'connected':    statusDot.classList.add('status-connected'); statusText.textContent = customText || 'APIs Connected'; break;
    case 'partial':      statusDot.classList.add('status-partial');   statusText.textContent = customText || 'Partial'; break;
    case 'disconnected': statusDot.classList.add('status-disconnected'); statusText.textContent = customText || 'No API Keys'; break;
    case 'working':      statusDot.classList.add('status-working');   statusText.textContent = customText || 'Fetching...'; break;
  }
}

function checkApiStatus() {
  const hasTavily = tavilyInput && tavilyInput.value.trim().length > 0;
  const hasGithub = githubInput && githubInput.value.trim().length > 0;
  if (hasTavily && hasGithub) setApiStatus('connected');
  else if (hasTavily) setApiStatus('partial');
  else setApiStatus('disconnected');
}

// ─── LLM Call ───
async function callLLM(systemPrompt, userPrompt, maxTokens = 2000) {
  const token = githubInput ? githubInput.value.trim() : '';
  if (!token) throw new Error('LLM API Key is required. Unlock the keys section and enter your GitHub token.');

  const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Tavily Search ───
async function fetchTavilySearch(query) {
  const apiKey = tavilyInput.value.trim();
  if (!apiKey) throw new Error('Tavily API key is missing. Unlock the keys section.');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query: query, search_depth: 'advanced', include_answer: true, max_results: 5 })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tavily Error (${response.status}): ${errorBody}`);
  }
  return await response.json();
}

// ─── Analyze competitor ───
async function analyzeCompetitor(rawContent, companyName) {
  try {
    const result = await callLLM(
      `You are a competitive intelligence analyst. Respond with ONLY valid JSON, no markdown. Analyze press coverage and return:
- "summary": concise 1-2 sentence actionable summary (max 50 words) of what the press is saying — include specific product names, funding, revenue, partnerships. Be specific.
- "trend": exactly one of: "Trending", "High Growth", "Steady", "Emerging", "Stagnant", "Declining"
Return ONLY the JSON object.`,
      `Analyze press intelligence for ${companyName}:\n\n${rawContent}`,
      150
    );
    let cleaned = result.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { summary: parsed.summary || rawContent.substring(0, 200), trend: parsed.trend || 'Steady' };
  } catch {
    return { summary: rawContent.substring(0, 200), trend: 'Steady' };
  }
}

// ─── Progress ───
function showProgress(msg, sub) {
  listElement.innerHTML = `
    <div class="signal-item loading-pulse">
      <div class="signal-time"><span class="signal-dot dot-working"></span>${msg}</div>
      <div class="one-line-summary">${sub || ''}</div>
    </div>`;
}

// ─── Main Refresh ───
async function handleRefresh() {
  refreshBtn.classList.add('loading');
  refreshBtn.disabled = true;
  setApiStatus('working', 'Discovering...');

  // The editable prompt (customizable per department)
  const editablePrompt = promptTextarea ? promptTextarea.value.trim() : DEFAULT_PROMPT;

  // ALWAYS inject hardcoded Lunim context + the editable prompt
  const fullPrompt = `${LUNIM_CONTEXT_INJECTION}\n\n== DEPARTMENT INSTRUCTIONS ==\n${editablePrompt}`;

  try {
    // STEP 1: Discover competitors
    showProgress('STEP 1 — DISCOVERING COMPETITORS...', 'Sending prompt to LLM...');

    const llmResponse = await callLLM(
      `You are a market research analyst for ${LUNIM_PROFILE.name}, a tech company in the ${LUNIM_PROFILE.industry} space. Respond with ONLY a valid JSON array. No markdown. Each object must have: "name", "space", "query". Focus on competitors relevant to the company's industry and pillars.`,
      fullPrompt, 3000
    );

    let competitors;
    try {
      let cleaned = llmResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      competitors = JSON.parse(cleaned);
    } catch { throw new Error('Failed to parse LLM response. Check your prompt.'); }

    if (!Array.isArray(competitors) || !competitors.length) throw new Error('No competitors found.');

    renderCompetitorCards(competitors.map(c => ({ ...c, trend: 'Pending' })));

    // STEP 2 & 3: Search + Analyze
    const enrichedCompetitors = [];
    const liveSignals = [];

    for (let i = 0; i < competitors.length; i++) {
      const company = competitors[i];
      setApiStatus('working', `${i + 1}/${competitors.length}: ${company.name}`);
      showProgress(`SEARCHING ${i + 1}/${competitors.length}...`, `Fetching press for ${company.name}...`);

      try {
        const searchResults = await fetchTavilySearch(company.query);
        let rawContent = searchResults.answer || '';
        const sources = [];

        if (searchResults.results && searchResults.results.length > 0) {
          searchResults.results.slice(0, 5).forEach(r => sources.push({ url: r.url, title: r.title || '' }));
          const snippets = searchResults.results.slice(0, 4).map(r => r.content).join('\n');
          rawContent = rawContent ? `${rawContent}\n\n${snippets}` : snippets;
        }

        if (!rawContent) rawContent = 'No recent press coverage found.';

        const analysis = await analyzeCompetitor(rawContent, company.name);

        enrichedCompetitors.push({ ...company, trend: analysis.trend });
        liveSignals.push({ company: company.name, summary: analysis.summary, time: 'Live Now', sources });

        // Progressive update
        const pending = competitors.slice(i + 1).map(c => ({ ...c, trend: 'Pending' }));
        renderCompetitorCards([...enrichedCompetitors, ...pending]);
      } catch (err) {
        enrichedCompetitors.push({ ...company, trend: 'Unknown' });
        liveSignals.push({ company: company.name, summary: `⚠ ${err.message}`, time: 'Error', sources: [] });
      }
    }

    renderCompetitorCards(enrichedCompetitors);
    renderSignals(liveSignals);
  } catch (e) {
    listElement.innerHTML = `
      <div class="signal-item">
        <div class="signal-time"><span class="signal-dot dot-error"></span>ERROR</div>
        <div class="one-line-summary">⚠ ${e.message}</div>
      </div>`;
  } finally {
    refreshBtn.classList.remove('loading');
    refreshBtn.disabled = false;
    checkApiStatus();
  }
}

// ─── Init ───
checkApiStatus();
refreshBtn.addEventListener('click', handleRefresh);

if (tavilyInput) tavilyInput.addEventListener('input', () => { localStorage.setItem('tavily-key', tavilyInput.value.trim()); checkApiStatus(); });
if (githubInput) githubInput.addEventListener('input', () => { localStorage.setItem('github-key', githubInput.value.trim()); checkApiStatus(); });

document.querySelectorAll('.toggle-visibility').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    if (input) { input.type = input.type === 'password' ? 'text' : 'password'; btn.textContent = input.type === 'password' ? '👁' : '🔒'; }
  });
});
