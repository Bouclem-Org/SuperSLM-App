import { escapeHtml } from './dom';

const inlineMd = (s: string): string =>
  escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export const renderMarkdown = (md: string): string => {
  let html = '';
  let inList = false;
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMd(line.slice(2))}</li>`;
      continue;
    }
    if (inList) {
      html += '</ul>';
      inList = false;
    }
    if (line.startsWith('## ')) html += `<h3>${inlineMd(line.slice(3))}</h3>`;
    else if (line.startsWith('# ')) continue;
    else if (line !== '') html += `<p>${inlineMd(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
};
