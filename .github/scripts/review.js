const fs = require('fs');

function readChangedFiles() {
  if (!fs.existsSync('changed_files.txt')) return [];

  const raw = fs.readFileSync('changed_files.txt', 'utf8');
  if (!raw || raw.trim() === '') return [];

  const files = raw
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean);

  const MAX_FILES = 15;
  const MAX_CHARS_PER_FILE = 8000;
  const results = [];

  for (const file of files.slice(0, MAX_FILES)) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        let content = fs.readFileSync(file, 'utf8');
        if (content.length > MAX_CHARS_PER_FILE) {
          content = content.slice(0, MAX_CHARS_PER_FILE) + '\n... (truncated, file too large)';
        }
        results.push({ file, content });
      }
    } catch (e) {
      // binary or unreadable file, skip
    }
  }
  return results;
}

async function main() {
  const diff = fs.existsSync('pr_trimmed.diff')
    ? fs.readFileSync('pr_trimmed.diff', 'utf8')
    : '';

  const changedFiles = readChangedFiles();

  const filesContext = changedFiles.map(f =>
    `### Full content of ${f.file}\n\`\`\`\n${f.content}\n\`\`\``
  ).join('\n\n');

  const systemPrompt = `You are a senior software engineer performing a thorough code review on a GitHub Pull Request for a Node.js and React application.

You are given:
1. The PR diff (what changed)
2. The full current content of each changed file (for context on the whole function/component, not just the changed lines)

Evaluate BOTH:
- Correctness and functionality: does the code actually do what it appears intended to do? Any bugs, edge cases, race conditions, broken logic?
- Code quality and approach: is this the best/idiomatic way to write it, or a simplistic/naive approach that works but should be improved? Call out simpler-than-necessary or overly complex implementations, poor naming, missing error handling, missing input validation, security issues (secrets, injection, npm dependency risks), missing tests, and maintainability concerns.

Judge severity strictly:
- Critical: breaks functionality, security vulnerability, data loss risk
- High: likely bug, missing critical error handling, significant security concern
- Medium: works but poor approach/practice, should be improved before merge
- Low: minor style/naming/nit, optional improvement

Respond ONLY in this exact markdown format, nothing else, no preamble:

# GPT Review

## Strengths
(list strengths, or "None identified" if none)

## Issues Found
| Severity | File | Line | Issue |
|----------|------|------|-------|
(one row per issue; if none, use: | None | - | - | No issues found |)

## Functionality Check
(does the code work as intended based on full file context? explain briefly)

## Risk Level
(Low / Medium / High / Critical, with one line explanation)

## Recommendation
(APPROVED or CHANGES REQUESTED, with reason)

STATUS: PASS
(Use STATUS: PASS only if Risk Level is Low and there are no Critical or High issues.
Use STATUS: FAIL if there is any Critical or High severity issue, or Risk Level is Medium or above.
This exact "STATUS: PASS" or "STATUS: FAIL" line must be the very last line of your response.)`;

  const userContent = `## PR Diff\n\`\`\`diff\n${diff || '(no diff content available)'}\n\`\`\`\n\n## Changed Files (full content)\n${filesContext || 'No readable file content available.'}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.2
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Groq API error:', JSON.stringify(data));
    process.exitCode = 1;
    return;
  }

  const review = data.choices[0].message.content;
  fs.writeFileSync('claude-review.md', review);

  const statusMatch = review.match(/STATUS:\s*(PASS|FAIL)/i);
  const status = statusMatch ? statusMatch[1].toUpperCase() : 'FAIL';

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `review_status=${status}\n`);
  }

  console.log(`SUCCESS: claude-review.md written. STATUS=${status}`);
}

main();
