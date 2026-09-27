import { getSettings } from '../api';
import { isDebugEnabled, reportDebug } from '../core/debug';
import { byId, escapeHtml } from '../core/dom';
import { onTabOpen } from '../core/tabs';

const ICON_SEND = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
const ERR_CODE = 'CHAT_NOT_IMPLEMENTED';

const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

export const mountChat = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="chat">
      <p class="chat-model" id="chat-model">Model: —</p>
      <div class="chat-scroll" id="chat-scroll">
        <p class="chat-empty" id="chat-empty">Chat with a local model — coming soon. Try sending a message anyway.</p>
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
  const modelLabel = byId('chat-model');

  const refreshModel = (): void => {
    getSettings()
      .then((s) => {
        modelLabel.textContent = s.modelFile
          ? `Model: ${fileName(s.modelFile)} (local)`
          : 'No model selected';
      })
      .catch((err: unknown) => console.error('Failed to load settings:', err));
  };

  const addMsg = (kind: 'user' | 'error', html: string): void => {
    empty.hidden = true;
    const div = document.createElement('div');
    div.className = `msg msg-${kind}`;
    div.innerHTML = `<div class="msg-body">${html}</div>`;
    scroll.appendChild(div);
    scroll.scrollTop = scroll.scrollHeight;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMsg('user', escapeHtml(text));
    input.value = '';
    reportDebug('chat.send', new Error(`${ERR_CODE}: no model connected`));
    const detail = isDebugEnabled()
      ? `<pre class="debug-block">${ERR_CODE}\n${new Date().toISOString()}\nchat.send → no model connected</pre>`
      : '';
    addMsg('error', `<p>Chat isn't implemented yet — no model is connected.</p>${detail}`);
  });

  refreshModel();
  onTabOpen('chat', refreshModel);
};
