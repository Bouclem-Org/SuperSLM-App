import { escapeHtml } from './dom';
import { icon } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectHandle {
  setOptions: (options: SelectOption[]) => void;
  getValue: () => string;
  setValue: (value: string) => void;
  reset: () => void;
  onChange: (cb: (value: string) => void) => void;
}

export const mountSelect = (host: HTMLElement, placeholder: string): SelectHandle => {
  host.classList.add('csel');
  host.innerHTML = `
    <button class="csel-btn" type="button">
      <span class="csel-label">${escapeHtml(placeholder)}</span>
      ${icon('caret').replace('class="icon"', 'class="icon csel-caret"')}
    </button>
    <div class="csel-menu" hidden></div>`;

  const btn = host.querySelector<HTMLButtonElement>('.csel-btn')!;
  const label = host.querySelector<HTMLElement>('.csel-label')!;
  const menu = host.querySelector<HTMLDivElement>('.csel-menu')!;

  let value = '';
  let options: SelectOption[] = [];
  const listeners: ((v: string) => void)[] = [];

  const close = (): void => {
    menu.hidden = true;
    host.classList.remove('is-open');
  };

  btn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    host.classList.toggle('is-open', !menu.hidden);
  });

  document.addEventListener('click', (e) => {
    if (!host.contains(e.target as Node)) close();
  });

  const setValue = (v: string): void => {
    value = v;
    label.textContent = options.find((o) => o.value === v)?.label ?? placeholder;
  };

  return {
    setOptions: (opts) => {
      options = opts;
      menu.innerHTML = opts.length
        ? opts
            .map(
              (o) => `
            <button class="csel-opt" type="button" data-v="${escapeHtml(o.value)}">
              <span>${escapeHtml(o.label)}</span>
              ${o.hint ? `<small>${escapeHtml(o.hint)}</small>` : ''}
            </button>`
            )
            .join('')
        : '<p class="csel-empty">Nothing here yet</p>';
      menu.querySelectorAll<HTMLButtonElement>('.csel-opt').forEach((el) => {
        el.addEventListener('click', () => {
          setValue(el.dataset.v ?? '');
          close();
          listeners.forEach((cb) => cb(value));
        });
      });
    },
    getValue: () => value,
    setValue,
    reset: () => {
      value = '';
      label.textContent = placeholder;
    },
    onChange: (cb) => listeners.push(cb)
  };
};
