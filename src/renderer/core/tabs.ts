const tabHooks = new Map<string, () => void>();

export const onTabOpen = (name: string, hook: () => void): void => {
  tabHooks.set(name, hook);
};

export const showTab = (name: string): void => {
  document
    .querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]')
    .forEach((n) => n.classList.toggle('is-active', n.dataset.tab === name));
  document.getElementById('settings-btn')?.classList.toggle('is-active', name === 'settings');
  document
    .querySelectorAll<HTMLElement>('.tab')
    .forEach((t) => t.classList.toggle('is-visible', t.id === `tab-${name}`));
  tabHooks.get(name)?.();
};

export const initTabs = (): void => {
  document
    .querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]')
    .forEach((item) =>
      item.addEventListener('click', () => {
        showTab(item.dataset.tab ?? 'home');
        document.getElementById('nav-more')?.classList.remove('is-open');
      })
    );
  document.getElementById('nav-more-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('nav-more')?.classList.toggle('is-open');
  });
  document.addEventListener('click', (e) => {
    const more = document.getElementById('nav-more');
    if (more && !more.contains(e.target as Node)) more.classList.remove('is-open');
  });
  document.getElementById('settings-btn')?.addEventListener('click', () => showTab('settings'));
};
