const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
};

const navItems = document.querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]');
const settingsBtn = byId('settings-btn') as HTMLButtonElement;
const tabs = document.querySelectorAll<HTMLElement>('.tab');

const showTab = (name: string): void => {
  navItems.forEach((n) => n.classList.toggle('is-active', n.dataset.tab === name));
  settingsBtn.classList.toggle('is-active', name === 'settings');
  tabs.forEach((t) => t.classList.toggle('is-visible', t.id === `tab-${name}`));
  if (name === 'settings') loadChangelog();
};

navItems.forEach((item) => {
  item.addEventListener('click', () => showTab(item.dataset.tab ?? 'home'));
});

settingsBtn.addEventListener('click', () => showTab('settings'));

const settingsItems = document.querySelectorAll<HTMLButtonElement>('.settings-item[data-settings]');
const settingsPages = document.querySelectorAll<HTMLElement>('.settings-page');

settingsItems.forEach((item) => {
  item.addEventListener('click', () => {
    settingsItems.forEach((n) => n.classList.toggle('is-active', n === item));
    settingsPages.forEach((p) =>
      p.classList.toggle('is-visible', p.id === `settings-${item.dataset.settings}`)
    );
  });
});

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inlineMd = (s: string): string => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const renderChangelog = (md: string): string => {
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

let changelogLoaded = false;
const loadChangelog = (): void => {
  if (changelogLoaded || !window.superslm?.getChangelog) return;
  window.superslm
    .getChangelog()
    .then((md) => {
      byId('changelog-body').innerHTML = renderChangelog(md);
      changelogLoaded = true;
    })
    .catch((err: unknown) => {
      console.error('Failed to load changelog:', err);
      byId('changelog-body').textContent = 'Could not load changelog.';
    });
};

const hour = new Date().getHours();
const greeting =
  hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
byId('greeting').textContent = greeting;

byId('date-line').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
});

window.superslm
  ?.getAppInfo()
  .then((info) => {
    byId('app-info').textContent = `v${info.appVersion}`;
    byId('set-version').textContent = info.appVersion;
    byId('set-electron').textContent = info.versions.electron ?? '—';
    byId('set-chrome').textContent = info.versions.chrome ?? '—';
    byId('set-platform').textContent = info.platform;
  })
  .catch((err: unknown) => console.error('Failed to load app info:', err));
