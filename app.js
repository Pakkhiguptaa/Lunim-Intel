// ─── Lunim Intel - Competitor Intelligence Dashboard ───
// Powered by Tavily Search + GitHub Models (GPT-4o) Summarization

const DEFAULT_TAVILY_KEY = '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';
const DEFAULT_GITHUB_TOKEN = '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';

const companies = [
  { query: 'Runway AI latest news funding product launch 2026', name: 'Runway' },
  { query: 'Stage32 entertainment network latest news partnerships 2026', name: 'Stage32' },
  { query: 'IDEO design thinking latest news trends 2026', name: 'IDEO' },
  { query: 'Coursera online education latest news acquisitions 2026', name: 'Coursera' }
];

const initialSignals = [
  { company: 'Runway', summary: 'The press highlights Runway\'s $315M Series E funding and the launch of real-time conversational "Runway Characters" as key milestones.', time: 'Cached' },
  { company: 'Coursera', summary: 'Media reports focus on Coursera\'s strategic acquisition of Udemy and the launch of AI Professional Certificates to bridge the GenAI skill gap.', time: 'Cached' },
  { company: 'IDEO', summary: 'Insights from IDEO point towards a shift to "Sentient Branding" and lo-fi aesthetics like "Notes App Chic" for 2026 design trends.', time: 'Cached' },
  { company: 'Stage32', summary: 'Recent coverage spotlights Stage32\'s global expansion through Hollywood training partnerships in Curacao and major film contests.', time: 'Cached' }
];

// ─── DOM References ───
const listElement = document.getElementById('intelligence-list');
const refreshBtn = document.getElementById('refresh-action');
const tavilyInput = document.getElementById('tavily-key');
const githubInput = document.getElementById('github-key');
const statusDot = document.getElementById('api-status-dot');
const statusText = document.getElementById('api-status-text');

// ─── Pre-fill API keys ───
if (tavilyInput) tavilyInput.value = DEFAULT_TAVILY_KEY;
if (githubInput) githubInput.value = DEFAULT_GITHUB_TOKEN;

// ─── Render Signals ───
function renderSignals(data) {
  listElement.innerHTML = '';
  data.forEach((signal, index) => {
    const item = document.createElement('div');
    item.className = 'signal-item';
    item.style.animationDelay = `${index * 0.1}s`;
    item.style.opacity = '0';

    const isLive = signal.time === 'Live Now';
    const isError = signal.time === 'Error';

    item.innerHTML = `
      <div class="signal-time">
        <span class="signal-dot ${isLive ? 'dot-live' : isError ? 'dot-error' : 'dot-cached'}"></span>
        ${signal.time.toUpperCase()} • ${signal.company.toUpperCase()}
      </div>
      <div class="one-line-summary">${signal.summary}</div>
    `;
    listElement.appendChild(item);
  });
}

// ─── Update API Status Indicator ───
function setApiStatus(state) {
  if (!statusDot || !statusText) return;
  statusDot.className = 'status-dot';
  switch (state) {
    case 'connected':
      statusDot.classList.add('status-connected');
      statusText.textContent = 'APIs Connected';
      break;
    case 'partial':
      statusDot.classList.add('status-partial');
      statusText.textContent = 'Partial (Tavily only)';
      break;
    case 'disconnected':
      statusDot.classList.add('status-disconnected');
      statusText.textContent = 'No API Keys';
      break;
    case 'working':
      statusDot.classList.add('status-working');
      statusText.textContent = 'Fetching...';
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

// ─── GitHub Models GPT-4o Summarization ───
async function summarizeWithGPT4o(rawText, companyName) {
  const token = githubInput ? githubInput.value.trim() : '';
  if (!token) {
    // No GitHub token — return raw text trimmed
    return rawText.substring(0, 250);
  }

  try {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive intelligence analyst. Write a concise, one-line press summary (max 40 words) focusing on the most important recent development. Be specific with names, numbers, and dates.'
          },
          {
            role: 'user',
            content: `Summarize the latest press intelligence for ${companyName}:\n\n${rawText}`
          }
        ],
        max_tokens: 80,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.warn(`GPT-4o summarization failed (${response.status}), using Tavily answer instead`);
      return rawText.substring(0, 250);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || rawText.substring(0, 250);
  } catch (err) {
    console.warn('GPT-4o summarization error:', err);
    return rawText.substring(0, 250);
  }
}

// ─── Main Refresh Handler ───
async function handleRefresh() {
  refreshBtn.classList.add('loading');
  refreshBtn.disabled = true;
  setApiStatus('working');

  listElement.innerHTML = `
    <div class="signal-item loading-pulse">
      <div class="signal-time">
        <span class="signal-dot dot-working"></span>
        ANALYZING...
      </div>
      <div class="one-line-summary">Searching live press signals and generating intelligent summaries...</div>
    </div>
  `;

  try {
    const liveSignals = [];

    for (const company of companies) {
      try {
        // Step 1: Tavily Live Search
        const searchResults = await fetchTavilySearch(company.query);

        // Get the raw answer or first result content
        let rawContent = searchResults.answer || '';

        // Also gather snippets from top results for richer context
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

        // Step 2: GPT-4o Summarization via GitHub Models
        const summary = await summarizeWithGPT4o(rawContent, company.name);

        liveSignals.push({
          company: company.name,
          summary: summary.replace(/\n/g, ' '),
          time: 'Live Now'
        });
      } catch (err) {
        console.error(`Error for ${company.name}:`, err);
        liveSignals.push({
          company: company.name,
          summary: `⚠ ${err.message}`,
          time: 'Error'
        });
      }
    }

    renderSignals(liveSignals.length > 0 ? liveSignals : initialSignals);

    // Update last-updated timestamp
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
      const now = new Date();
      lastUpdated.textContent = `LAST UPDATED: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (e) {
    console.error('General Error:', e);
    renderSignals(initialSignals);
  } finally {
    refreshBtn.classList.remove('loading');
    refreshBtn.disabled = false;
    checkApiStatus();
  }
}

// ─── Initialization ───
renderSignals(initialSignals);
checkApiStatus();

// ─── Event Listeners ───
refreshBtn.addEventListener('click', handleRefresh);

// Update status when keys change
if (tavilyInput) tavilyInput.addEventListener('input', checkApiStatus);
if (githubInput) githubInput.addEventListener('input', checkApiStatus);

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
