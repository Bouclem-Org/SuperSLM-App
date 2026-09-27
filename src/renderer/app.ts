import { getAppInfo, getSettings } from './api';
import { setDebugEnabled } from './core/debug';
import { byId } from './core/dom';
import { initTabs } from './core/tabs';
import { applyTheme, initTheme } from './core/theme';
import { mountChat } from './views/chat';
import { mountHome } from './views/home';
import { mountModels } from './views/models';
import { mountSettings } from './views/settings';

mountHome(byId('tab-home'));
mountModels(byId('tab-models'));
mountChat(byId('tab-chat'));
mountSettings(byId('tab-settings'));

initTabs();
initTheme();

getSettings()
  .then((settings) => {
    applyTheme(settings.theme);
    setDebugEnabled(settings.debug);
  })
  .catch((err) => console.error('Failed to load settings:', err));

getAppInfo()
  .then((info) => {
    byId('app-info').textContent = `v${info.appVersion}`;
  })
  .catch((err) => console.error('Failed to load app info:', err));
