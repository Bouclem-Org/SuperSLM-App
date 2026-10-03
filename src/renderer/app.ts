import { getAppInfo, getSettings } from './api';
import { setDebugEnabled } from './core/debug';
import { initSideChats } from './core/chats';
import { byId } from './core/dom';
import { initTabs } from './core/tabs';
import { applyFontScale, applyTheme, initTheme } from './core/theme';
import { mountChat } from './views/chat';
import { mountFinetune } from './views/finetune';
import { mountHome } from './views/home';
import { mountLibrary } from './views/library';
import { mountModels } from './views/models';
import { mountSettings } from './views/settings';

mountHome(byId('tab-home'));
mountModels(byId('tab-models'));
mountChat(byId('tab-chat'));
mountLibrary(byId('tab-library'));
mountFinetune(byId('tab-finetune'));
mountSettings(byId('tab-settings'));

initTabs();
initTheme();
initSideChats();

getSettings()
  .then((settings) => {
    applyTheme(settings.theme);
    applyFontScale(settings.fontScale);
    setDebugEnabled(settings.debug);
  })
  .catch((err) => console.error('Failed to load settings:', err));

getAppInfo()
  .then((info) => {
    byId('app-info').textContent = `v${info.appVersion}`;
  })
  .catch((err) => console.error('Failed to load app info:', err));
