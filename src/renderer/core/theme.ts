import { patchSettings, setZoom } from '../api';

export const applyTheme = (theme: LmTheme): void => {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach((r) => {
    r.checked = r.value === theme;
  });
};

export const applyFontScale = (scale: number): void => {
  setZoom(scale);
  document.querySelectorAll<HTMLInputElement>('input[name="textsize"]').forEach((r) => {
    r.checked = Number(r.value) === scale;
  });
};

export const initTheme = (): void => {
  document.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === 'theme') {
      const theme = target.value as LmTheme;
      applyTheme(theme);
      patchSettings({ theme }).catch((err: unknown) =>
        console.error('Failed to save theme:', err)
      );
      return;
    }
    if (target.name === 'textsize') {
      const fontScale = Number(target.value);
      applyFontScale(fontScale);
      patchSettings({ fontScale }).catch((err: unknown) =>
        console.error('Failed to save text size:', err)
      );
    }
  });
};
