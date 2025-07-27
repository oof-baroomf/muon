export function escapeHtml(str: string): string {
  return str.replace(/[&<>"]/g, c => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function parseInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\[([^[]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return result;
}

export function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  let html = '';
  let inList = false;
  let inCode = false;

  for (const line of lines) {
    if (inCode) {
      if (line.trim().startsWith('```')) {
        html += '</code></pre>';
        inCode = false;
        continue;
      }
      html += escapeHtml(line) + '\n';
      continue;
    }

    if (line.trim().startsWith('```')) {
      html += '<pre><code>';
      inCode = true;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h${heading[1].length}>${parseInline(heading[2])}</h${heading[1].length}>`;
      continue;
    }

    const list = line.match(/^[-*]\s+(.*)/);
    if (list) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${parseInline(list[1])}</li>`;
      continue;
    } else if (inList) {
      html += '</ul>';
      inList = false;
    }

    if (line.trim() === '') {
      html += '<br>';
      continue;
    }

    html += `<p>${parseInline(line)}</p>`;
  }

  if (inList) html += '</ul>';
  if (inCode) html += '</code></pre>';
  return html;
}
