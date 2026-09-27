const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
};

const navItems = document.querySelectorAll<HTMLButtonElement>('.nav-item[data-tab]');
const tabs = document.querySelectorAll<HTMLElement>('.tab');

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((n) => n.classList.toggle('is-active', n === item));
    tabs.forEach((t) => t.classList.toggle('is-visible', t.id === `tab-${item.dataset.tab}`));
  });
});

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
    byId('app-info').textContent = `Electron ${info.versions.electron}`;
  })
  .catch((err: unknown) => console.error('Failed to load app info:', err));
