import { getAppInfo, getChangelog } from '../api';
import { byId } from '../core/dom';
import { renderMarkdown } from '../core/markdown';
import { onTabOpen } from '../core/tabs';

const ICON_GENERAL = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const ICON_THEME = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg>`;
const ICON_CHANGELOG = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`;

const initMenu = (): void => {
  const items = document.querySelectorAll<HTMLButtonElement>('.settings-item[data-settings]');
  const pages = document.querySelectorAll<HTMLElement>('.settings-page');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      items.forEach((n) => n.classList.toggle('is-active', n === item));
      pages.forEach((p) =>
        p.classList.toggle('is-visible', p.id === `settings-${item.dataset.settings}`)
      );
    });
  });
};

const initAbout = (): void => {
  getAppInfo()
    .then((info) => {
      byId('set-version').textContent = info.appVersion;
      byId('set-electron').textContent = info.versions.electron ?? '—';
      byId('set-chrome').textContent = info.versions.chrome ?? '—';
      byId('set-platform').textContent = info.platform;
    })
    .catch((err: unknown) => console.error('Failed to load app info:', err));
};

let changelogLoaded = false;
const loadChangelog = (): void => {
  if (changelogLoaded) return;
  getChangelog()
    .then((md) => {
      byId('changelog-body').innerHTML = renderMarkdown(md);
      changelogLoaded = true;
    })
    .catch((err: unknown) => {
      console.error('Failed to load changelog:', err);
      byId('changelog-body').textContent = 'Could not load changelog.';
    });
};

export const mountSettings = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="settings">
      <nav class="settings-menu" aria-label="Settings">
        <p class="settings-heading">Settings</p>
        <button class="settings-item is-active" data-settings="general" type="button">
          ${ICON_GENERAL} General
        </button>
        <button class="settings-item" data-settings="theme" type="button">
          ${ICON_THEME} Theme
        </button>
        <button class="settings-item" data-settings="changelog" type="button">
          ${ICON_CHANGELOG} Changelog
        </button>
      </nav>

      <div class="settings-pane">
        <div class="settings-page is-visible" id="settings-general">
          <h2 class="page-title">General</h2>
          <dl class="about-list">
            <div class="about-row"><dt>Version</dt><dd id="set-version">—</dd></div>
            <div class="about-row"><dt>Electron</dt><dd id="set-electron">—</dd></div>
            <div class="about-row"><dt>Chromium</dt><dd id="set-chrome">—</dd></div>
            <div class="about-row"><dt>Platform</dt><dd id="set-platform">—</dd></div>
          </dl>
        </div>

        <div class="settings-page" id="settings-theme">
          <h2 class="page-title">Theme</h2>
          <div class="theme-options" role="radiogroup" aria-label="Theme">
            <label class="theme-option">
              <input type="radio" name="theme" value="dark" />
              <span>Dark</span>
              <small>Warm grey, low light</small>
            </label>
            <label class="theme-option">
              <input type="radio" name="theme" value="light" />
              <span>Light</span>
              <small>Warm paper, daytime</small>
            </label>
          </div>
          <p class="settings-note">Saved to ~/.superslm/settings.json</p>
        </div>

        <div class="settings-page" id="settings-changelog">
          <h2 class="page-title">Changelog</h2>
          <div class="changelog" id="changelog-body"></div>
        </div>
      </div>
    </div>`;

  initMenu();
  initAbout();
  onTabOpen('settings', loadChangelog);
};
