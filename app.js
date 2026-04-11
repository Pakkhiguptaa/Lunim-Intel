// ─── Lunim Intel - Competitor Intelligence Dashboard ───
// Powered by Tavily Search + GitHub Models (GPT-4o) Summarization
// Fully prompt-driven: the intelligence prompt controls everything.

const KEYS_PASSWORD = 'Coffee';

// ─── HARDCODED LUNIM COMPANY CONTEXT (hidden from UI, always injected) ───
const LUNIM_COMPANY_CONTEXT = `Lunim is a tech company at the intersection of AI and Web3.

Lunim operates across four core pillars, with reference competitors in each:

1. Film Community & Entertainment Networking
   Reference competitors: Film3, Decentralized Pictures, MovieLabs, Tribeca Studios, Stage 32

2. UX Consulting & Design Thinking
   Reference competitors: IDEO (AI Lab), Framer, Galileo AI, Uizard, Diagram (acquired by Figma)

3. AI Studio & Video Generation
   Reference competitors: Runway, Pika, Sora (OpenAI), Luma AI, Kling (Kuaishou), Synthesia

4. AI Education & Online Learning
   Reference competitors: Section (formerly Section4), Synthesis AI, Maven, Coursera (AI tracks), DataCamp

The top competitors for Lunim span these four fields. Use the reference competitors as anchors to discover similar companies in each space — include both the named references and any other emerging or established competitors.`;

// ─── HARDCODED INTELLIGENCE CATEGORIES (always injected, not visible in UI) ───
const INTELLIGENCE_CATEGORIES = `The following intelligence categories are MANDATORY parameters. Every search must gather information across ALL of these categories:

1. FUNDING & DEALS — funding rounds, M&A activity, investments, acquisitions, business deals, revenue milestones
2. PRODUCT LAUNCHES — new products, feature releases, platform updates, technical innovations, product pivots
3. PARTNERSHIPS & ALLIANCES — strategic partnerships, collaborations, joint ventures, integrations, ecosystem plays
4. MARKETING CAMPAIGNS — notable marketing campaigns, brand strategies, viral content, go-to-market moves, rebranding
5. MARKET SIGNALS — expansion news, hiring surges, layoffs, leadership changes, regulatory moves, market entry/exit
6. CUSTOMER SENTIMENT — customer feedback, feature requests, pain points, reviews, community discussions, churn signals

These categories are the baseline. The user's prompt below may emphasize or narrow the focus to specific categories, but all categories should still be considered when crafting search queries.`;

// ─── DEFAULT INTELLIGENCE PROMPT (editable by the user — focuses output within the hardcoded categories) ───
const DEFAULT_PROMPT = `Give me a general overview of what our competitors are doing — cover all areas including deals, product updates, partnerships, and market moves.`;

// ─── DEFAULT SYSTEM PROMPT (hardcoded, drives LLM behavior) ───
const DEFAULT_SYSTEM_PROMPT = `You are a market research and competitive intelligence analyst for Lunim.

You will receive:
1. A company profile describing Lunim, its four business pillars, and reference competitors.
2. A set of MANDATORY intelligence categories that define the types of information you must search for.
3. A user's intelligence request that may focus on specific areas or ask for a general overview.

Your job:
1. Based on Lunim's company profile, identify the top {COUNT} competitors across the four pillars Lunim operates in.
2. Read the user's intelligence request carefully. Their request may emphasize certain intelligence categories (e.g. "focus on funding rounds" or "what marketing campaigns worked") — if so, weight your search queries toward those areas while still maintaining broad coverage.
3. If the user's request is general, ensure balanced coverage across ALL mandatory intelligence categories.
4. For each competitor, craft a Tavily web-search query that captures the intelligence the user is asking for. The query should be specific, current (2026), and actionable.

Respond with ONLY a valid JSON array. No markdown, no explanation.
Each object must have exactly these keys:
- "name": the company or entity name
- "space": a short category label (e.g. "AI Video", "EdTech", "SaaS", etc.)
- "query": a Tavily web-search query tailored to the user's request and intelligence categories`;

const DEFAULT_COMPETITOR_COUNT = 20;

// ─── Dynamic space colors (assigns colors consistently based on space name) ───
const SPACE_COLOR_PALETTE = [
  '#e11d48', '#10b981', '#7c3aed', '#2563eb',
  '#f59e0b', '#06b6d4', '#ec4899', '#84cc16',
  '#8b5cf6', '#14b8a6', '#f97316', '#6366f1',
  '#ef4444', '#22c55e', '#a855f7', '#0ea5e9'
];

const spaceColorMap = new Map();
let colorIndex = 0;

function getSpaceColor(space) {
  if (!space) return '#6366f1';
  const key = space.toLowerCase().trim();
  if (!spaceColorMap.has(key)) {
    spaceColorMap.set(key, SPACE_COLOR_PALETTE[colorIndex % SPACE_COLOR_PALETTE.length]);
    colorIndex++;
  }
  return spaceColorMap.get(key);
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
const notionKeyInput = document.getElementById('notion-key');
const notionPageInput = document.getElementById('notion-page-id');
const notionDbInput = document.getElementById('notion-db-id');

const statusDot = document.getElementById('api-status-dot');
const statusText = document.getElementById('api-status-text');
const promptTextarea = document.getElementById('intelligence-prompt');
const competitorGrid = document.getElementById('competitor-grid');
const signalCountBadge = document.getElementById('signal-count-badge');
const competitorCountBadge = document.getElementById('competitor-count-badge');
const resetPromptBtn = document.getElementById('reset-prompt');

// Competitor count elements
const competitorCountSlider = document.getElementById('competitor-count-slider');
const competitorCountValue = document.getElementById('competitor-count-value');

// Save and Repository references
const savePromptBtn = document.getElementById('save-prompt');
const navItems = document.querySelectorAll('.nav-item');
const dashboardView = document.getElementById('dashboard-view');
const repositoryView = document.getElementById('repository-view');
const repositorySectionsContainer = document.getElementById('repository-sections-container');
const repositoryEmptyState = document.getElementById('repository-empty-state');

// Modal Elements
const addPromptModal = document.getElementById('add-prompt-modal');
const modalPromptText = document.getElementById('modal-prompt-text');
const modalCategoryLabel = document.getElementById('modal-category');
const modalSaveBtn = document.getElementById('modal-save');
const modalCancelBtn = document.getElementById('modal-cancel');

let currentModalCategory = 'General';

// ─── Initial Repository Examples ───
const REPOSITORY_EXAMPLES = [
  { id: 'ex1', category: 'Funding', text: 'What funding rounds, acquisitions, or business deals have our competitors closed recently?', date: 'System' },
  { id: 'ex2', category: 'Products', text: 'What new features, tools, or platform updates have competitors launched?', date: 'System' },
  { id: 'ex3', category: 'Campaigns', text: 'What marketing campaigns or brand moves have competitors made that gained traction?', date: 'System' },
  { id: 'ex4', category: 'Partnerships', text: 'What strategic partnerships or integrations have been announced?', date: 'System' },
  { id: 'ex5', category: 'Customer Intel', text: 'What are customers saying about competitor products — any common requests or complaints?', date: 'System' }
];

// ─── Categorization Logic ───
const CATEGORY_MAP = {
  'Funding': ['funding', 'acquisitions', 'deals', 'rounds', 'm&a', 'capital', 'investment', 'venture'],
  'Products': ['features', 'tools', 'platform', 'updates', 'launched', 'software', 'hardware', 'release', 'product'],
  'Campaigns': ['marketing', 'campaigns', 'brand', 'moves', 'traction', 'advertising', 'viral', 'gtm'],
  'Partnerships': ['partnerships', 'integrations', 'collaborations', 'alliances', 'joint', 'ecosystem'],
  'Customer Intel': ['customers', 'saying', 'reviews', 'complaints', 'requests', 'feedback', 'sentiment', 'pain points', 'users']
};

function getPromptCategory(text) {
  const content = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => content.includes(k))) return category;
  }
  return 'General';
}


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
const llmEndpointInput = document.getElementById('llm-endpoint');
if (llmEndpointInput) llmEndpointInput.value = localStorage.getItem('llm-endpoint') || '';
const _defaults = window.LUNIM_DEFAULTS || {};
if (notionKeyInput) notionKeyInput.value = localStorage.getItem('notion-key') || _defaults.notionKey || '';
if (notionPageInput) notionPageInput.value = localStorage.getItem('notion-page-id') || _defaults.notionPageId || '';
if (notionDbInput) notionDbInput.value = _defaults.notionDbId || localStorage.getItem('notion-db-id') || '';

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

// ─── Competitor Count Slider ───
if (competitorCountSlider) {
  const savedCount = localStorage.getItem('competitor-count');
  if (savedCount) {
    competitorCountSlider.value = savedCount;
    if (competitorCountValue) competitorCountValue.textContent = savedCount;
  }
  competitorCountSlider.addEventListener('input', () => {
    const val = competitorCountSlider.value;
    if (competitorCountValue) competitorCountValue.textContent = val;
    localStorage.setItem('competitor-count', val);
  });
}

// ─── Save Prompt ───
if (savePromptBtn) {
  savePromptBtn.addEventListener('click', () => {
    const prompt = (promptTextarea ? promptTextarea.value.trim() : '').trim();
    if (!prompt) return;

    let savedPrompts = JSON.parse(localStorage.getItem('saved-prompts') || '[]');
    
    // Avoid duplicates
    if (savedPrompts.find(p => p.text === prompt)) {
      alert('Prompt is already saved in the repository.');
      return;
    }

    const newPrompt = {
      id: Date.now(),
      text: prompt,
      category: getPromptCategory(prompt),
      date: new Date().toLocaleDateString()
    };

    savedPrompts.unshift(newPrompt); // Add to beginning
    localStorage.setItem('saved-prompts', JSON.stringify(savedPrompts));
    
    // Feedback
    savePromptBtn.innerHTML = '✅ Prompt Saved';
    savePromptBtn.disabled = true;
    setTimeout(() => {
      savePromptBtn.innerHTML = `
        <svg style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        Save Prompt
      `;
      savePromptBtn.disabled = false;
    }, 2000);
    
    renderRepository();
  });
}

// ─── Repository Management ───
function renderRepository() {
  if (!repositorySectionsContainer) return;
  const savedPrompts = JSON.parse(localStorage.getItem('saved-prompts') || '[]');
  
  // Combine examples with saved prompts
  const allPrompts = [...REPOSITORY_EXAMPLES, ...savedPrompts];
  
  // Group by category
  const grouped = allPrompts.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // Define sort order
  const categories = ['Funding', 'Products', 'Campaigns', 'Partnerships', 'Customer Intel', 'General'];

  repositorySectionsContainer.innerHTML = '';
  
  const hasItems = Object.keys(grouped).length > 0;
  if (!hasItems) {
    if (repositoryEmptyState) repositoryEmptyState.style.display = 'flex';
    return;
  }
  if (repositoryEmptyState) repositoryEmptyState.style.display = 'none';

  categories.forEach(category => {
    if (!grouped[category] || grouped[category].length === 0) return;

    const section = document.createElement('div');
    section.className = 'repository-section';
    
    section.innerHTML = `
      <div class="section-header">
        <span class="section-title">${category}</span>
        <span class="section-count">${grouped[category].length}</span>
      </div>
      <div class="repository-grid"></div>
    `;

    const grid = section.querySelector('.repository-grid');
    
    // Add "Add Prompt" Card
    const addCard = document.createElement('div');
    addCard.className = 'add-prompt-card';
    addCard.innerHTML = `
      <div class="add-prompt-icon">+</div>
      <div class="add-prompt-text">Add to ${category}</div>
    `;
    addCard.addEventListener('click', () => openAddModal(category));
    grid.appendChild(addCard);

    grouped[category].forEach(p => {
      const isSystem = p.date === 'System';
      const card = document.createElement('div');
      card.className = 'prompt-card';
      
      card.innerHTML = `
        <div class="prompt-card-header">
          <div>
            <div class="prompt-card-title">${isSystem ? 'Template' : 'Saved Prompt'}</div>
            <div class="prompt-card-date">${p.date}</div>
          </div>
        </div>
        <div class="prompt-card-content">${p.text}</div>
        <div class="prompt-card-actions">
          <button class="btn-primary btn-action use-prompt-btn" data-id="${p.id}">Use Prompt</button>
          ${!isSystem ? `<button class="btn-delete btn-action delete-prompt-btn" data-id="${p.id}">Delete</button>` : ''}
        </div>
      `;

      card.querySelector('.use-prompt-btn').addEventListener('click', () => {
        if (promptTextarea) {
          promptTextarea.value = p.text;
          localStorage.setItem('intelligence-prompt', p.text);
        }
        switchView('dashboard');
      });

      if (!isSystem) {
        card.querySelector('.delete-prompt-btn').addEventListener('click', () => {
          let currentPrompts = JSON.parse(localStorage.getItem('saved-prompts') || '[]');
          currentPrompts = currentPrompts.filter(item => item.id !== p.id);
          localStorage.setItem('saved-prompts', JSON.stringify(currentPrompts));
          renderRepository();
        });
      }

      grid.appendChild(card);
    });

    repositorySectionsContainer.appendChild(section);
  });
}

// ─── View Switching ───
function switchView(viewName) {
  if (viewName === 'dashboard') {
    dashboardView.style.display = 'block';
    repositoryView.style.display = 'none';
  } else if (viewName === 'repository') {
    dashboardView.style.display = 'none';
    repositoryView.style.display = 'block';
    renderRepository();
  }

  // Update nav UI
  navItems.forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    switchView(item.dataset.view);
  });
});

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
  const hasNotion = notionKeyInput && notionKeyInput.value.trim().length > 0;
  
  if (hasTavily && hasGithub && hasNotion) setApiStatus('connected');
  else if (hasTavily && hasGithub) setApiStatus('partial', 'Missing Notion');
  else if (hasTavily) setApiStatus('partial', 'Tavily Only');
  else setApiStatus('disconnected');
}

// ─── Notion API Call ───
async function callNotionProxy(endpoint, method, body) {
  const token = (notionKeyInput ? notionKeyInput.value.trim() : '') || _defaults.notionKey || '';
  if (!token) throw new Error('Notion API Key is required.');

  // Routing through the Vercel internal /api/notion proxy to bypass CORS
  const response = await fetch('/api/notion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: endpoint,
      method: method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: body
    })
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errorBody = await response.json();
      errorMsg = errorBody.message || errorMsg;
    } catch (_) {}
    throw new Error(`Notion Proxy Error (${response.status}): ${errorMsg}`);
  }
  return await response.json();
}

async function ensureNotionDatabase() {
  let dbId = (notionDbInput ? notionDbInput.value.trim() : '') || _defaults.notionDbId || '';
  if (dbId) return dbId;

  const pageId = (notionPageInput ? notionPageInput.value.trim() : '') || _defaults.notionPageId || '';
  if (!pageId) throw new Error('Notion Page ID is required to create a database.');

  const dbSchema = {
    parent: { type: "page_id", page_id: pageId },
    title: [{ type: "text", text: { content: "Lunim Intel Search Results" } }],
    properties: {
      "Company": { title: {} },
      "Space": { rich_text: {} },
      "Trend": { select: { options: [
        { name: "Trending", color: "red" },
        { name: "High Growth", color: "purple" },
        { name: "Steady", color: "blue" },
        { name: "Emerging", color: "green" },
        { name: "Stagnant", color: "orange" },
        { name: "Declining", color: "gray" }
      ]}},
      "Summary": { rich_text: {} },
      "Sources": { url: {} },
      "Search Date": { date: {} },
      "Prompt": { rich_text: {} }
    }
  };

  const db = await callNotionProxy('databases', 'POST', dbSchema);
  dbId = db.id;
  if (notionDbInput) {
    notionDbInput.value = dbId;
    localStorage.setItem('notion-db-id', dbId);
  }
  return dbId;
}

async function syncToNotion(enrichedCompetitors, liveSignals, prompt) {
  try {
    const dbId = await ensureNotionDatabase();

    const searchDate = new Date().toISOString();

    for (const signal of liveSignals) {
      const comp = enrichedCompetitors.find(c => c.name === signal.company) || {};
      const firstSource = signal.sources && signal.sources.length > 0 ? signal.sources[0].url : '';

      const pageData = {
        parent: { database_id: dbId },
        properties: {
          "Company": { title: [{ text: { content: signal.company.substring(0, 100) } }] },
          "Space": { rich_text: [{ text: { content: (comp.space || "N/A").substring(0, 100) } }] },
          "Trend": { select: { name: comp.trend || "Steady" } },
          "Summary": { rich_text: [{ text: { content: signal.summary.substring(0, 1999) } }] },
          "Search Date": { date: { start: searchDate } },
          "Prompt": { rich_text: [{ text: { content: prompt.substring(0, 1999) } }] }
        }
      };

      if (firstSource) {
        pageData.properties["Sources"] = { url: firstSource };
      }

      await callNotionProxy('pages', 'POST', pageData);
    }
    
    return true;
  } catch (err) {
    console.error('Notion Sync Failed:', err);
    listElement.innerHTML += `
      <div class="signal-item" style="border-color: var(--accent-danger); background: rgba(239, 68, 68, 0.1);">
        <div class="signal-time"><span class="signal-dot dot-error"></span>NOTION SYNC FAILED</div>
        <div class="one-line-summary">⚠ ${err.message}</div>
        <div style="font-size: 0.6rem; margin-top: 4px; opacity: 0.7;">Check that your Notion Integration is added to the Parent Page via "Connect to".</div>
      </div>`;
    throw err;
  }
}

// ─── LLM Call ───
async function callLLM(systemPrompt, userPrompt, maxTokens = 2000) {
  const token = githubInput ? githubInput.value.trim() : '';
  if (!token) throw new Error('LLM API Key is required. Unlock the keys section and enter your API key.');

  const endpointInput = document.getElementById('llm-endpoint');
  const url = (endpointInput ? endpointInput.value.trim() : '') || 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model,
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

  // Reset color map for fresh results
  spaceColorMap.clear();
  colorIndex = 0;

  // Combine: company context + intelligence categories + user's question
  const intelligenceQuestion = promptTextarea ? promptTextarea.value.trim() : DEFAULT_PROMPT;
  const fullUserPrompt = `${LUNIM_COMPANY_CONTEXT}\n\n${INTELLIGENCE_CATEGORIES}\n\n--- User Intelligence Request ---\n${intelligenceQuestion}`;

  // Get competitor count and build system prompt (with {COUNT} placeholder replaced)
  const competitorCount = competitorCountSlider ? parseInt(competitorCountSlider.value) : DEFAULT_COMPETITOR_COUNT;
  const systemPrompt = DEFAULT_SYSTEM_PROMPT.replace(/\{COUNT\}/g, competitorCount);

  try {
    // STEP 1: Discover competitors
    showProgress('STEP 1 — DISCOVERING COMPETITORS...', `Finding top ${competitorCount} competitors...`);

    const llmResponse = await callLLM(
      systemPrompt,
      fullUserPrompt, 3000
    );

    let competitors;
    try {
      let cleaned = llmResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      competitors = JSON.parse(cleaned);
    } catch { throw new Error('Failed to parse LLM response. Try adjusting your prompt.'); }

    if (!Array.isArray(competitors) || !competitors.length) throw new Error('No competitors found. Try adjusting your prompt.');

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

    // STEP 4: Sync to Notion (non-destructive — signals are already rendered)
    try {
      await syncToNotion(enrichedCompetitors, liveSignals, intelligenceQuestion);
      setApiStatus('connected', 'All Data Synced');
    } catch (notionErr) {
      // Notion failure is non-fatal: results are already displayed
      setApiStatus('partial', 'Notion sync failed');
    }

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
if (llmEndpointInput) llmEndpointInput.addEventListener('input', () => { localStorage.setItem('llm-endpoint', llmEndpointInput.value.trim()); });
if (githubInput) githubInput.addEventListener('input', () => { localStorage.setItem('github-key', githubInput.value.trim()); checkApiStatus(); });
if (notionKeyInput) notionKeyInput.addEventListener('input', () => { localStorage.setItem('notion-key', notionKeyInput.value.trim()); checkApiStatus(); });
if (notionPageInput) notionPageInput.addEventListener('input', () => { localStorage.setItem('notion-page-id', notionPageInput.value.trim()); checkApiStatus(); });
if (notionDbInput) notionDbInput.addEventListener('input', () => { localStorage.setItem('notion-db-id', notionDbInput.value.trim()); checkApiStatus(); });

document.querySelectorAll('.toggle-visibility').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    if (input) { input.type = input.type === 'password' ? 'text' : 'password'; btn.textContent = input.type === 'password' ? '👁' : '🔒'; }
  });
});

// ─── Modal Logic ───
function openAddModal(category) {
  if (!addPromptModal || !modalCategoryLabel || !modalPromptText) return;
  currentModalCategory = category;
  modalCategoryLabel.textContent = category;
  modalPromptText.value = '';
  addPromptModal.classList.add('active');
  modalPromptText.focus();
}

function closeAddModal() {
  if (addPromptModal) addPromptModal.classList.remove('active');
}

if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeAddModal);

if (modalSaveBtn) {
  modalSaveBtn.addEventListener('click', () => {
    const text = modalPromptText.value.trim();
    if (!text) return;

    let savedPrompts = JSON.parse(localStorage.getItem('saved-prompts') || '[]');
    const newPrompt = {
      id: Date.now(),
      text: text,
      category: currentModalCategory,
      date: new Date().toLocaleDateString()
    };

    savedPrompts.unshift(newPrompt);
    localStorage.setItem('saved-prompts', JSON.stringify(savedPrompts));
    
    closeAddModal();
    renderRepository();
  });
}

// Close modal on click outside
if (addPromptModal) {
  addPromptModal.addEventListener('click', (e) => {
    if (e.target === addPromptModal) closeAddModal();
  });
}
