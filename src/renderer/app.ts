import { getAppInfo, getSettings } from './api';
import { byId } from './core/dom';
import { initTabs } from './core/tabs';
import { applyTheme, initTheme } from './core/theme';
import { mountHome } from './views/home';
import { mountModels } from './views/models';
import { mountSettings } from './views/settings';

mountHome(byId('tab-home'));
mountModels(byId('tab-models'));
mountSettings(byId('tab-settings'));

initTabs();
initTheme();

getSettings()
  .then((settings) => applyTheme(settings.theme))
  .catch((err) => console.error('Failed to load settings:', err));

getAppInfo()
  .then((info) => {
    byId('app-info').textContent = `v${info.appVersion}`;
  })
  .catch((err) => console.error('Failed to load app info:', err));
