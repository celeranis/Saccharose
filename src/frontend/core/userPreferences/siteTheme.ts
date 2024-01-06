import Cookies from 'js-cookie';
import { toBoolean } from '../../../shared/util/genericUtil.ts';
import { Listener } from '../../util/eventListen.ts';


export function isNightmode(): boolean {
  return toBoolean(Cookies.get('nightmode'));
}

export function isDaymode(): boolean {
  return !isNightmode();
}

export function setSiteTheme(theme: 'daymode' | 'nightmode') {
  console.log('Site theme changed to:', theme);

  document.querySelectorAll<HTMLButtonElement>('.toggle-theme-buttons button').forEach(el => {
    if (el.value === theme) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  if (theme === 'daymode') {
    document.body.classList.remove('nightmode');
    document.documentElement.classList.remove('nightmode');
    Cookies.remove('nightmode');
    document.querySelectorAll('.os-scrollbar').forEach(scrollbar => {
      scrollbar.classList.remove('os-theme-light');
      scrollbar.classList.add('os-theme-dark');
    });
  } else if (theme === 'nightmode') {
    document.body.classList.add('nightmode');
    document.documentElement.classList.add('nightmode');
    Cookies.set('nightmode', '1', { expires: 365 });
    document.querySelectorAll('.os-scrollbar').forEach(scrollbar => {
      scrollbar.classList.remove('os-theme-dark');
      scrollbar.classList.add('os-theme-light');
    });
  }
}

export const SiteThemeListener: Listener = {
  selector: '.toggle-theme-buttons button',
  event: 'click',
  multiple: true,
  handle: function(_event: MouseEvent, target: HTMLButtonElement) {
    setSiteTheme(target.value as any);
  }
};
