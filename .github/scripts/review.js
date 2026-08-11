const fs = require('fs');

async function main() {
  const diff = fs.readFileSync('pr_trimmed.diff', 'utf8');

  const systemPrompt = `You are a senior software engineer reviewing a GitHub Pull Request for a Node.js and React application.
Check: code quality, bugs, security vulnerabilities, npm dependency risks, React best practices, Node.js best practices, test coverage, performance, error handling, input validation, authentication/authorization, secrets or sensitive info, maintainability, configuration problems.

Respond ONLY in this exact markdown format, nothing else:

# GPT Review

## Strengths
(list strengths)

## Issues Found
| Severity | File | Line | Issue |
|----------|------|------|-------|
(one row per issue; if none, use: | None | - | - | No issues found |)

## Risk Level
(Low / Medium / High / Critical, with one line explanation)

## Recommendation
(APPROVED or CHANGES REQUESTED, with reason)`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the PR diff:\n\n${diff}` }
      ],
      temperature: 0.2
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('OpenAI API error:', JSON.stringify(data));
    process.exit(1);
  }

  const review = data.choices[0].message.content;
  fs.writeFileSync('claude-review.md', review);
  console.log('SUCCESS: claude-review.md written.');
}

main();
