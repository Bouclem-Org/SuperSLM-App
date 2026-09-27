import { patchSettings } from '../api';

export const applyTheme = (theme: SuperslmTheme): void => {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach((r) => {
    r.checked = r.value === theme;
  });
};

export const initTheme = (): void => {
  document.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name !== 'theme') return;
    const theme = target.value as SuperslmTheme;
    applyTheme(theme);
    patchSettings({ theme }).catch((err: unknown) =>
      console.error('Failed to save theme:', err)
    );
  });
};
