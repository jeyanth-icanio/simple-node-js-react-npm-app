const fs = require('fs');
const path = require('path');

const prNumber = process.env.PR_NUMBER;
const prDir = process.env.PR_DIR; // e.g. pages-publish/reviews/pr9

const entries = fs.readdirSync(prDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()
  .reverse(); // newest first, since folder names are timestamps

const rows = entries.map(name => {
  const readable = name.replace('T', ' ').replace(/-/g, (m, offset, str) => {
    // Only replace dashes after the date part with colons for time
    return m;
  });
  return `<tr><td><a href="${name}/index.html">${name}</a></td></tr>`;
}).join('\n');

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Scan History - PR #${prNumber}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 25px;line-height:1.6;color:#24292f;background:#fff}
h1{border-bottom:2px solid #ddd;padding-bottom:10px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{border:1px solid #d0d7de;padding:10px;text-align:left}
th{background:#f6f8fa}
tr:nth-child(even){background:#f9f9f9}
a{color:#0969da;text-decoration:none}
a:hover{text-decoration:underline}
.count{color:#57606a;font-size:14px;margin-bottom:20px}
</style></head><body>
<h1>Scan History - PR #${prNumber}</h1>
<div class="count">${entries.length} scan(s) recorded</div>
<table>
<tr><th>Scan Timestamp (UTC)</th></tr>
${rows}
</table>
</body></html>`;

fs.writeFileSync(path.join(prDir, 'index.html'), html);
console.log(`SUCCESS: history index built with ${entries.length} entries.`);
