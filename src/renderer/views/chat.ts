import { chatSend, getSettings, localModels, patchSettings } from '../api';
import { isDebugEnabled, reportDebug } from '../core/debug';
import { byId, escapeHtml } from '../core/dom';
import { onTabOpen } from '../core/tabs';

const ICON_SEND = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;

const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

export const mountChat = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="chat">
      <div class="chat-top">
        <select id="chat-model-sel" class="chat-model-sel" aria-label="Model"></select>
      </div>
      <div class="chat-scroll" id="chat-scroll">
        <p class="chat-empty" id="chat-empty">Pick a model above, then send a message.</p>
      </div>
      <form class="chat-bar" id="chat-form">
        <input
          id="chat-input"
          class="chat-input"
          type="text"
          placeholder="Message…"
          autocomplete="off"
        />
        <button class="chat-send" type="submit" aria-label="Send">${ICON_SEND}</button>
      </form>
    </div>`;

  const scroll = byId('chat-scroll');
  const empty = byId('chat-empty');
  const form = byId('chat-form') as HTMLFormElement;
  const input = byId('chat-input') as HTMLInputElement;
  const sel = byId('chat-model-sel') as HTMLSelectElement;

  const history: SuperslmChatMessage[] = [];
  let pending = false;

  const refreshModels = (): void => {
    void Promise.all([localModels(), getSettings()])
      .then(([list, s]) => {
        const extra =
          s.modelFile && !list.some((m) => m.path === s.modelFile)
            ? `<option value="${escapeHtml(s.modelFile)}">${escapeHtml(fileName(s.modelFile))} (file)</option>`
            : '';
        sel.innerHTML =
          `<option value="" disabled${s.modelFile ? '' : ' selected'}>Pick a model…</option>` +
          extra +
          list
            .map((m) => `<option value="${escapeHtml(m.path)}">${escapeHtml(m.name)}</option>`)
            .join('');
        if (s.modelFile) sel.value = s.modelFile;
      })
      .catch((err: unknown) => console.error('Failed to load models:', err));
  };

  sel.addEventListener('change', () => {
    patchSettings({ modelFile: sel.value }).catch((err: unknown) =>
      console.error('Failed to save model:', err)
    );
  });

  const addMsg = (kind: string, html: string): HTMLElement => {
    empty.hidden = true;
    const div = document.createElement('div');
    div.className = `msg msg-${kind}`;
    div.innerHTML = `<div class="msg-body">${html}</div>`;
    scroll.appendChild(div);
    scroll.scrollTop = scroll.scrollHeight;
    return div;
  };

  const debugBlock = (err: unknown): string =>
    isDebugEnabled()
      ? `<pre class="debug-block">${escapeHtml(String(err))}\n${new Date().toISOString()}</pre>`
      : '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || pending) return;
    if (!sel.value) {
      addMsg('error', '<p>Pick a model above first — a downloaded one or a local .gguf.</p>');
      return;
    }
    addMsg('user', escapeHtml(text));
    history.push({ role: 'user', content: text });
    input.value = '';
    pending = true;
    const thinking = addMsg('thinking', '<em>Starting model / thinking…</em>');
    chatSend(history)
      .then((res) => {
        thinking.className = 'msg msg-assistant';
        thinking.innerHTML = `<div class="msg-body">${escapeHtml(res.content)}</div>`;
        history.push({ role: 'assistant', content: res.content });
      })
      .catch((err: unknown) => {
        reportDebug('chat.send', err);
        thinking.className = 'msg msg-error';
        thinking.innerHTML = `<div class="msg-body"><p>Chat failed — ${escapeHtml(
          err instanceof Error ? err.message : String(err)
        )}</p>${debugBlock(err)}</div>`;
        history.pop();
      })
      .finally(() => {
        pending = false;
        scroll.scrollTop = scroll.scrollHeight;
        input.focus();
      });
  });

  refreshModels();
  onTabOpen('chat', refreshModels);
};
