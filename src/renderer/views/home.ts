export const mountHome = (root: HTMLElement): void => {
  root.innerHTML = `
    <p class="eyebrow" id="greeting">Welcome</p>
    <h1 class="title">SuperSLM</h1>
    <p class="lede">A quiet home for small models. More is on the way.</p>
    <div class="meta"><span id="date-line"></span></div>`;

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? 'Up late'
      : hour < 12
        ? 'Good morning'
        : hour < 18
          ? 'Good afternoon'
          : 'Good evening';

  const greetingEl = root.querySelector('#greeting');
  const dateEl = root.querySelector('#date-line');
  if (greetingEl) greetingEl.textContent = greeting;
  if (dateEl)
    dateEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
};
