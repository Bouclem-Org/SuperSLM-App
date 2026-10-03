import {
  chatSend,
  chatsLoad,
  chatsSave,
  getSettings,
  localModels,
  patchSettings
} from '../api';
import { refreshSideChats, setActiveSideChat, setChatOpener, setNewChatHandler } from '../core/chats';
import { isDebugEnabled, reportDebug } from '../core/debug';
import { byId, escapeHtml } from '../core/dom';
import { fileName } from '../core/format';
import { mountSelect } from '../core/select';
import { onTabOpen } from '../core/tabs';

const ICON_SEND = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;

const newChatId = (): string => `c${Date.now().toString(36)}`;

const chatTitle = (messages: SuperslmChatMessage[]): string =>
  messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'Chat';

export const mountChat = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="chat">
      <div class="chat-top">
        <div id="chat-model-sel"></div>
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
  let empty = byId('chat-empty');
  const form = byId('chat-form') as HTMLFormElement;
  const input = byId('chat-input') as HTMLInputElement;
  const modelSel = mountSelect(byId('chat-model-sel'), 'Pick a model…');

  let history: SuperslmChatMessage[] = [];
  let chatId = newChatId();
  let pending = false;

  const addMsg = (kind: string, html: string): HTMLElement => {
    empty.hidden = true;
    const div = document.createElement('div');
    div.className = `msg msg-${kind}`;
    div.innerHTML = `<div class="msg-body">${html}</div>`;
    scroll.appendChild(div);
    scroll.scrollTop = scroll.scrollHeight;
    return div;
  };

  const renderAll = (): void => {
    scroll.innerHTML = '';
    if (!history.length) {
      const p = document.createElement('p');
      p.className = 'chat-empty';
      p.id = 'chat-empty';
      p.textContent = 'Pick a model above, then send a message.';
      scroll.appendChild(p);
      empty = p;
      return;
    }
    history.forEach((m) => addMsg(m.role, escapeHtml(m.content)));
  };

  const refreshModels = (): void => {
    void Promise.all([localModels(), getSettings()])
      .then(([list, s]) => {
        modelSel.setOptions([
          ...s.localFiles
            .filter((p) => !list.some((m) => m.path === p))
            .map((p) => ({ value: p, label: fileName(p), hint: 'file' })),
          ...list.map((m) => ({ value: m.path, label: m.name }))
        ]);
        modelSel.setValue(s.modelFile);
      })
      .catch((err: unknown) => console.error('Failed to load models:', err));
  };

  modelSel.onChange((value) => {
    patchSettings({ modelFile: value }).catch((err: unknown) =>
      console.error('Failed to save model:', err)
    );
  });

  setChatOpener((id) => {
    chatsLoad(id)
      .then((chat) => {
        chatId = id;
        history = chat.messages;
        renderAll();
      })
      .catch((err: unknown) => reportDebug('chat.load', err));
  });

  setNewChatHandler(() => {
    history = [];
    chatId = newChatId();
    setActiveSideChat(chatId);
    refreshSideChats();
    renderAll();
    input.focus();
  });

  const debugBlock = (err: unknown): string =>
    isDebugEnabled()
      ? `<pre class="debug-block">${escapeHtml(String(err))}\n${new Date().toISOString()}</pre>`
      : '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || pending) return;
    if (!modelSel.getValue()) {
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
        void chatsSave(chatId, chatTitle(history), history).then(() => {
          setActiveSideChat(chatId);
          refreshSideChats();
        });
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
  onTabOpen('chat', () => {
    refreshModels();
    refreshSideChats();
  });
};
