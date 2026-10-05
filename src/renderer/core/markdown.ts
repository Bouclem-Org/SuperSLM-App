import { escapeHtml } from './dom';
import { icon } from './icons';

interface Stashed {
  tex: string;
  display: boolean;
}

const mathHtml = (tex: string, display: boolean): string =>
  `<span class="md-math" data-tex="${escapeHtml(tex)}" data-display="${display ? '1' : ''}"></span>`;

const inlineMd = (s: string, math: Stashed[]): string => {
  const codes: string[] = [];
  let t = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return ` CD${codes.length - 1} `;
  });
  t = t
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, x: string) => {
      math.push({ tex: x, display: true });
      return ` MT${math.length - 1} `;
    })
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, x: string) => {
      math.push({ tex: x, display: true });
      return ` MT${math.length - 1} `;
    })
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, x: string) => {
      math.push({ tex: x, display: false });
      return ` MT${math.length - 1} `;
    })
    .replace(/\$([^$\n]+?)\$/g, (_m, x: string) => {
      math.push({ tex: x, display: false });
      return ` MT${math.length - 1} `;
    });
  t = escapeHtml(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_m, text: string, url: string) =>
        `<a class="md-link" data-url="${url}">${text}</a>`
    )
    .replace(/ CD(\d+) /g, (_m, i: string) => `<code>${escapeHtml(codes[Number(i)])}</code>`)
    .replace(/ MT(\d+) /g, (_m, i: string) => {
      const st = math[Number(i)];
      return st ? mathHtml(st.tex, st.display) : '';
    });
  return t;
};

const splitRow = (line: string): string[] =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

const isTableSep = (line: string): boolean =>
  /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');

const isFence = (line: string): boolean => /^(`{3,}|~{3,})/.test(line.trim());

const codeBlock = (buf: string[]): string =>
  `<pre class="md-code"><button class="code-copy" type="button" title="Copy code">${icon('copy')}</button><code>${escapeHtml(
    buf.join('\n')
  )}</code></pre>`;

//TODO(markdown): nested lists, task lists (- [ ]), footnotes, syntax highlighting per fence lang
export const renderMarkdown = (md: string): string => {
  const lines = md.split('\n');
  const math: Stashed[] = [];
  let html = '';
  let i = 0;
  let inList: 'ul' | 'ol' | null = null;
  let inIndent = false;

  const closeList = (): void => {
    if (inList) {
      html += `</${inList}>`;
      inList = null;
    }
  };

  const closeIndent = (): void => {
    if (inIndent) {
      html += '</code></pre>';
      inIndent = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isFence(line)) {
      closeList();
      closeIndent();
      const marker = trimmed.slice(0, 3);
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      html += codeBlock(buf);
      continue;
    }

    if (/^\$\$/.test(trimmed)) {
      closeList();
      closeIndent();
      const buf: string[] = [];
      const rest = trimmed.slice(2);
      if (rest.endsWith('$$')) {
        buf.push(rest.slice(0, -2));
      } else {
        if (rest) buf.push(rest);
        i += 1;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          buf.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) buf.push(lines[i].trim().slice(0, -2));
        i += 1;
      }
      html += mathHtml(buf.join('\n'), true);
      continue;
    }

    const indented = /^( {4}|\t)/.test(line) && trimmed !== '';
    if (indented && !inList) {
      if (!inIndent) {
        closeList();
        html += `<pre class="md-code"><button class="code-copy" type="button" title="Copy code">${icon('copy')}</button><code>`;
        inIndent = true;
      } else {
        html += '\n';
      }
      html += escapeHtml(line.replace(/^( {4}|\t)/, ''));
      i += 1;
      continue;
    }
    closeIndent();

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
        .map((c) => `<th>${inlineMd(c, math)}</th>`)
        .join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c, math)}</td>`).join('')}</tr>`)
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
      html += `<li>${inlineMd((ulMatch ?? olMatch)![1], math)}</li>`;
      i += 1;
      continue;
    }

    closeList();

    const head = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (head) {
      const tag = head[1].length <= 2 ? 'h3' : 'h4';
      if (head[1].length > 1) html += `<${tag}>${inlineMd(head[2], math)}</${tag}>`;
    } else if (trimmed.startsWith('>')) {
      html += `<blockquote>${inlineMd(trimmed.slice(1).trim(), math)}</blockquote>`;
    } else if (trimmed !== '') {
      html += `<p>${inlineMd(trimmed, math)}</p>`;
    }
    i += 1;
  }

  closeList();
  closeIndent();
  return html;
};

declare global {
  interface Window {
    katex?: {
      render: (tex: string, el: HTMLElement, opts: { displayMode: boolean; throwOnError: boolean }) => void;
    };
  }
}

export const initMdClicks = (host: HTMLElement, openUrl: (url: string) => void): void => {
  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.code-copy')) {
      const code = t.closest('.md-code')?.querySelector('code');
      if (code) void navigator.clipboard.writeText(code.textContent ?? '');
      return;
    }
    const link = t.closest<HTMLElement>('a.md-link');
    if (link?.dataset.url) openUrl(link.dataset.url);
  });
};

export const renderMath = (root: ParentNode): void => {
  const katex = window.katex;
  if (!katex) return;
  root.querySelectorAll<HTMLElement>('.md-math').forEach((el) => {
    try {
      katex.render(el.dataset.tex ?? '', el, {
        displayMode: el.dataset.display === '1',
        throwOnError: false
      });
    } catch {
      el.textContent = el.dataset.tex ?? '';
    }
  });
};
