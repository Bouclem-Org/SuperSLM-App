import { chatsList } from '../api';
import { byId, escapeHtml } from './dom';
import { showTab } from './tabs';

type ChatOpener = (id: string) => void;

let openChatImpl: ChatOpener | null = null;
let newChatImpl: (() => void) | null = null;
let activeId = '';

const fmtDay = (ts: number): string =>
  ts
    ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

const openSideChat = (id: string): void => {
  activeId = id;
  showTab('chat');
  refreshSideChats();
  openChatImpl?.(id);
};

export const setChatOpener = (fn: ChatOpener): void => {
  openChatImpl = fn;
};

export const setNewChatHandler = (fn: () => void): void => {
  newChatImpl = fn;
};

export const setActiveSideChat = (id: string): void => {
  activeId = id;
};

export const initSideChats = (): void => {
  byId('side-new-chat').addEventListener('click', () => {
    showTab('chat');
    newChatImpl?.();
  });
  refreshSideChats();
};

export const refreshSideChats = (): void => {
  const host = byId('side-chats');
  chatsList()
    .then((chats) => {
      host.innerHTML = '';
      chats.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `side-chat${c.id === activeId ? ' is-active' : ''}`;
        btn.title = c.title;
        btn.innerHTML =
          `<span class="side-chat-title">${escapeHtml(c.title)}</span>` +
          `<span class="side-chat-day">${fmtDay(c.updated)}</span>`;
        btn.addEventListener('click', () => openSideChat(c.id));
        //TODO(chats): hover actions — rename + delete (needs chats:delete/chats:rename IPC)
        host.appendChild(btn);
      });
    })
    .catch((err: unknown) => console.error('Failed to load chats:', err));
};
