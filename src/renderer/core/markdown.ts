import { escapeHtml } from './dom';

const inlineMd = (s: string): string =>
  escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const splitRow = (line: string): string[] =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

const isTableSep = (line: string): boolean =>
  /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');

export const renderMarkdown = (md: string): string => {
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  let inList: 'ul' | 'ol' | null = null;

  const closeList = (): void => {
    if (inList) {
      html += `</${inList}>`;
      inList = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      closeList();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      html += `<pre class="md-code"><code>${escapeHtml(buf.join('\n'))}</code></pre>`;
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      html += `<table class="md-table"><thead><tr>${header
        .map((c) => `<th>${inlineMd(c)}</th>`)
        .join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
      continue;
    }

    const ulMatch = /^[-*]\s+(.+)/.exec(trimmed);
    const olMatch = /^\d+[.)]\s+(.+)/.exec(trimmed);
    if (ulMatch ?? olMatch) {
      const kind = ulMatch ? 'ul' : 'ol';
      if (inList !== kind) {
        closeList();
        html += `<${kind}>`;
        inList = kind;
      }
      html += `<li>${inlineMd((ulMatch ?? olMatch)![1])}</li>`;
      i += 1;
      continue;
    }

    closeList();

    const head = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (head) {
      const tag = head[1].length <= 2 ? 'h3' : 'h4';
      if (head[1].length > 1) html += `<${tag}>${inlineMd(head[2])}</${tag}>`;
    } else if (trimmed.startsWith('>')) {
      html += `<blockquote>${inlineMd(trimmed.slice(1).trim())}</blockquote>`;
    } else if (trimmed !== '') {
      html += `<p>${inlineMd(trimmed)}</p>`;
    }
    i += 1;
  }

  closeList();
  return html;
};
