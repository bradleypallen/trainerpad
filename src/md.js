// Minimal Markdown-subset → HTML for the in-app guide (GUIDE.md).
// Supports: # ## ### headings, **bold**, *italic*, `code`, [text](url),
// "- " unordered and "1. " ordered lists, blank-line-separated paragraphs.
// The whole source is HTML-escaped before parsing, so raw HTML never passes
// through. Known limitation: markdown syntax inside a `code` span is styled.
// IMPORTANT: Safari 15 target — no regex lookbehind anywhere in this file
// (esbuild does not transpile regexes; lookbehind fails to PARSE on
// Safari < 16.4 and would brick the entire bundle).

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s) =>
  s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

export function mdToHtml(md) {
  const out = [];
  let list = null; // null | 'ul' | 'ol'
  let para = [];
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const openList = (tag) => { if (list !== tag) { closeList(); out.push('<' + tag + '>'); list = tag; } };
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };

  for (const raw of escapeHtml(md).split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); closeList(); }
    else if ((m = /^(#{1,3}) (.+)$/.exec(line))) {
      flushPara(); closeList();
      const h = m[1].length;
      out.push('<h' + h + '>' + inline(m[2]) + '</h' + h + '>');
    }
    else if ((m = /^- (.+)$/.exec(line))) { flushPara(); openList('ul'); out.push('<li>' + inline(m[1]) + '</li>'); }
    else if ((m = /^\d+\. (.+)$/.exec(line))) { flushPara(); openList('ol'); out.push('<li>' + inline(m[1]) + '</li>'); }
    else { closeList(); para.push(line); }
  }
  flushPara(); closeList();
  return out.join('\n');
}
