const fs = require("fs");
const md = fs.readFileSync("claude-review.md", "utf8");
const prNumber = process.env.PR_NUMBER;
const timestamp = process.env.SCAN_TIMESTAMP || new Date().toISOString();

// Full HTML-unsafe character coverage, including backtick which the
// previous version missed (relevant since markdown content can contain
// backtick code spans that end up rendered directly into the page).
function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/`/g, "&#096;")
    .replace(/\//g, "&#x2F;");
}

function severityBadge(cellText) {
  const s = cellText.trim().toLowerCase();
  const map = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
    none: 'badge-none'
  };
  const cls = map[s];
  if (!cls) return escapeHtml(cellText);
  return `<span class="badge ${cls}">${escapeHtml(cellText)}</span>`;
}

const statusMatch = md.match(/STATUS:\s*(PASS|FAIL)/i);
const status = statusMatch ? statusMatch[1].toUpperCase() : 'UNKNOWN';
const mdBody = md.replace(/STATUS:\s*(PASS|FAIL)\s*$/i, '').trim();

const lines = mdBody.split(/\r?\n/);
let html = "";
let inTable = false;
let headerProcessed = false;
let tableColIsSeverity = false;

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
    if (!inTable) {
      html += "<table>\n";
      inTable = true;
      headerProcessed = false;
      tableColIsSeverity = cells[0].toLowerCase() === 'severity';
    }
    const tag = headerProcessed ? "td" : "th";
    html += "<tr>";
    cells.forEach((cell, idx) => {
      if (tag === 'td' && idx === 0 && tableColIsSeverity) {
        html += `<${tag}>${severityBadge(cell)}</${tag}>`;
      } else {
        html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
      }
    });
    html += "</tr>\n";
    headerProcessed = true;
    continue;
  }
  if (inTable) { html += "</table>\n"; inTable = false; headerProcessed = false; }
  if (line.trim() === "") { html += "<br>\n"; continue; }
  html += "<p>" + escapeHtml(line) + "</p>\n";
}
if (inTable) html += "</table>\n";

const statusClass = status === 'PASS' ? 'status-pass' : status === 'FAIL' ? 'status-fail' : 'status-unknown';
const statusLabel = status === 'PASS' ? 'PASSED — Safe to merge' : status === 'FAIL' ? 'FAILED — Changes required before merge' : 'STATUS UNKNOWN';

const htmlPage = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Code Review - PR #${prNumber} - ${timestamp}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 25px 80px;
    line-height: 1.65;
    color: #1f2328;
    background: #f6f8fa;
  }
  .back-link {
    display: inline-block;
    margin-bottom: 20px;
    font-size: 14px;
    color: #57606a;
    text-decoration: none;
  }
  .back-link:hover { color: #0969da; }
  .card {
    background: #ffffff;
    border: 1px solid #d0d7de;
    border-radius: 12px;
    padding: 32px 36px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
  }
  .pr-title { font-size: 14px; color: #57606a; }
  .pr-title strong { color: #1f2328; }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 14px;
  }
  .status-pass { background: #d1f4d1; color: #116329; border: 1px solid #4ac26b; }
  .status-fail { background: #ffe3e3; color: #82071e; border: 1px solid #e5484d; }
  .status-unknown { background: #eee; color: #555; border: 1px solid #ccc; }
  h1 { font-size: 22px; border-bottom: 2px solid #eaeef2; padding-bottom: 12px; margin-top: 0; }
  h2 { font-size: 17px; margin-top: 32px; color: #1f2328; border-bottom: 1px solid #eaeef2; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  th, td { border: 1px solid #d0d7de; padding: 10px 12px; text-align: left; vertical-align: top; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) td { background: #fbfcfd; }
  p { margin: 10px 0; font-size: 14.5px; }
  code { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .badge-critical { background: #ffe3e3; color: #82071e; }
  .badge-high { background: #fff1e0; color: #9a5300; }
  .badge-medium { background: #fff8c5; color: #7a6b00; }
  .badge-low { background: #ddf4ff; color: #0550ae; }
  .badge-none { background: #d1f4d1; color: #116329; }
  .footer-meta {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid #eaeef2;
    font-size: 12.5px;
    color: #8b949e;
  }
</style></head><body>
<a class="back-link" href="../index.html">&larr; Back to scan history for PR #${prNumber}</a>
<div class="card">
  <div class="top-bar">
    <div class="pr-title">Pull Request <strong>#${prNumber}</strong> &middot; Scanned ${timestamp}</div>
    <div class="status-pill ${statusClass}">${statusLabel}</div>
  </div>
  ${html}
  <div class="footer-meta">Automated review generated by AI. Use judgment before merging &mdash; this is an assistant, not a substitute for human review.</div>
</div>
</body></html>`;

fs.writeFileSync("claude-review.html", htmlPage);
console.log(`SUCCESS: claude-review.html created. STATUS=${status}`);
