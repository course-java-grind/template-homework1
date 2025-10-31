const axios = require('axios');
const { context } = require('@actions/github');
const { setFailed, setOutput } = require('@actions/core');

async function main() {
  const apiKey = process.env.PPLX_API_KEY;
  const diff = context.payload.pull_request.diff_url;  // Или fetch diff via GH API

  // Fetch PR diff (упрощённо; используйте GH API для полного)
  const diffResponse = await axios.get(context.payload.pull_request.diff_url, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` }
  });
  const codeDiff = diffResponse.data.substring(0, 4000);  // Лимит для токенов

  const prompt = `Проанализируй этот diff кода автотестирования (Java/Selenium/WireMock/Jenkins):
  - Ошибки: assertions, driver.quit(), mocks teardown, API responses.
  - Best practices: Page Object, error handling, CI/CD.
  - Предлагай fixes с кодом. Используй search для актуальных docs.
  Diff: ${codeDiff}`;

  try {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'claude-3-5-sonnet-20241022',  // Или 'sonar-large-online' для search
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.1  // Низкий для точности
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const review = response.data.choices[0].message.content;

    // Post comment to PR via GH API
    await axios.post(`${context.payload.repository.html_url}/pulls/${context.payload.pull_request.number}/comments`, {
      body: `### Perplexity AI Review\n${review}\n\nSources: [Perplexity]`
    }, {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    });

    console.log('Review posted');
  } catch (error) {
    setFailed(`API error: ${error.message}`);
  }
}

main();
