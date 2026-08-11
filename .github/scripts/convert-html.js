const fs = require("fs");
const md = fs.readFileSync("claude-review.md", "utf8");
const prNumber = process.env.PR_NUMBER;
const timestamp = process.env.SCAN_TIMESTAMP || new Date().toISOString();

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const lines = md.split(/\r?\n/);
let html = "";
let inTable = false;
let headerProcessed = false;

for (const line of lines) {
  if (line.startsWith("# ")) {
    if (inTable) { html += "</table>\n"; inTable = false; }
    html += "<h1>" + escapeHtml(line.substring(2)) + "</h1>\n";
    continue;
  }
  if (line.startsWith("## ")) {
    if (inTable) { html += "</table>\n"; inTable = false; }
    html += "<h2>" + escapeHtml(line.substring(3)) + "</h2>\n";
    continue;
  }
  if (line.startsWith("### ")) {
    if (inTable) { html += "</table>\n"; inTable = false; }
    html += "<h3>" + escapeHtml(line.substring(4)) + "</h3>\n";
    continue;
  }
  if (line.trim().startsWith("|")) {
    const trimmed = line.trim();
    const content = trimmed.substring(1, trimmed.length - 1);
    const cells = content.split("|").map(c => c.trim());
    const separator = cells.every(c => /^:?-+:?$/.test(c));
    if (separator) continue;
    if (!inTable) { html += "<table>\n"; inTable = true; headerProcessed = false; }
    const tag = headerProcessed ? "td" : "th";
    html += "<tr>";
    for (const cell of cells) html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
    html += "</tr>\n";
    headerProcessed = true;
    continue;
  }
  if (inTable) { html += "</table>\n"; inTable = false; headerProcessed = false; }
  if (line.trim() === "") { html += "<br>\n"; continue; }
  html += "<p>" + escapeHtml(line) + "</p>\n";
}
if (inTable) html += "</table>\n";

const htmlPage = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>GPT PR Review - PR #${prNumber} - ${timestamp}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;max-width:1100px;margin:40px auto;padding:0 25px;line-height:1.6;color:#24292f;background:#fff}
h1{border-bottom:2px solid #ddd;padding-bottom:10px}
h2{margin-top:35px;border-bottom:1px solid #ddd;padding-bottom:5px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background-color:#f6f8fa;font-weight:600}
th,td{border:1px solid #d0d7de;padding:10px;text-align:left;vertical-align:top}
tr:nth-child(even){background-color:#f9f9f9}
p{margin:10px 0}
.scan-meta{background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:12px 16px;margin-bottom:25px;font-size:14px;color:#57606a}
.back-link{display:inline-block;margin-bottom:15px;font-size:14px}
</style></head><body>
<a class="back-link" href="../index.html">&larr; Back to scan history for PR #${prNumber}</a>
<div class="scan-meta"><strong>PR #${prNumber}</strong> &middot; Scanned at: <strong>${timestamp}</strong></div>
${html}
</body></html>`;

fs.writeFileSync("claude-review.html", htmlPage);
console.log("SUCCESS: claude-review.html created.");
