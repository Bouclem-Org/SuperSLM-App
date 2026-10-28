import { chatsDelete, chatsList, chatsRename } from '../api';
import { byId, escapeHtml } from './dom';
import { icon } from './icons';
import { showTab } from './tabs';

const ICON_EDIT = icon('edit');
const ICON_TRASH = icon('trash');

type ChatOpener = (id: string) => void;

let openChatImpl: ChatOpener | null = null;
let newChatImpl: (() => void) | null = null;
let renameChatImpl: ((id: string, title: string) => void) | null = null;
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

export const setChatRenameHandler = (fn: (id: string, title: string) => void): void => {
  renameChatImpl = fn;
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

const startRename = (row: HTMLElement, c: LmChatMeta): void => {
  const titleEl = row.querySelector('.side-chat-title');
  if (!titleEl) return;
  const input = document.createElement('input');
  input.className = 'side-chat-rename';
  input.type = 'text';
  input.value = c.title;
  input.maxLength = 80;
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit: boolean): void => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    if (commit && title && title !== c.title) {
      void chatsRename(c.id, title)
        .then(() => {
          if (c.id === activeId) renameChatImpl?.(c.id, title);
        })
        .catch((err: unknown) => console.error('Failed to rename chat:', err))
        .finally(() => refreshSideChats());
    } else {
      refreshSideChats();
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
};

const askDelete = (btn: HTMLButtonElement, c: LmChatMeta): void => {
  if (!btn.classList.contains('is-armed')) {
    btn.classList.add('is-armed');
    btn.title = 'Click again to delete';
    setTimeout(() => {
      btn.classList.remove('is-armed');
      btn.title = 'Delete';
    }, 2500);
    return;
  }
  void chatsDelete(c.id)
    .then(() => {
      if (c.id === activeId) newChatImpl?.();
    })
    .catch((err: unknown) => console.error('Failed to delete chat:', err))
    .finally(() => refreshSideChats());
};

export const refreshSideChats = (): void => {
  const host = byId('side-chats');
  chatsList()
    .then((chats) => {
      host.innerHTML = '';
      chats.forEach((c) => {
        const row = document.createElement('div');
        row.className = `side-chat${c.id === activeId ? ' is-active' : ''}`;
        row.role = 'button';
        row.tabIndex = 0;
        row.title = c.title;
        row.innerHTML =
          `<span class="side-chat-title">${escapeHtml(c.title)}</span>` +
          `<span class="side-chat-acts">` +
          `<button class="side-chat-act" data-act="rename" type="button" aria-label="Rename" title="Rename">${ICON_EDIT}</button>` +
          `<button class="side-chat-act" data-act="del" type="button" aria-label="Delete" title="Delete">${ICON_TRASH}</button>` +
          `</span>` +
          `<span class="side-chat-day">${fmtDay(c.updated)}</span>`;
        row.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.side-chat-rename')) return;
          openSideChat(c.id);
        });
        row.addEventListener('keydown', (e) => {
          if (e.target === row && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openSideChat(c.id);
          }
        });
        row.querySelectorAll<HTMLButtonElement>('.side-chat-act').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.dataset.act === 'rename') startRename(row, c);
            else askDelete(btn, c);
          });
        });
        host.appendChild(row);
      });
    })
    .catch((err: unknown) => console.error('Failed to load chats:', err));
};
