const fetch = require('node-fetch');

const TAVILY_KEY = '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';
const GITHUB_TOKEN = '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';

async function testTavily() {
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_KEY,
                query: 'test',
                search_depth: 'advanced',
                max_results: 1
            })
        });
        const data = await response.text();
        console.log(`Tavily Response Status: ${response.status}`);
        console.log(`Tavily Data: ${data.substring(0, 100)}`);
    } catch (err) {
        console.error('Tavily Error:', err.message);
    }
}

async function testGithub() {
    try {
        const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Say hello' }],
                max_tokens: 10
            })
        });
        const data = await response.text();
        console.log(`GitHub Response Status: ${response.status}`);
        console.log(`GitHub Data: ${data.substring(0, 100)}`);
    } catch (err) {
        console.error('GitHub Error:', err.message);
    }
}

async function main() {
    await testTavily();
    await testGithub();
}

main();
