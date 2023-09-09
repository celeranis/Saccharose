import { modalService } from './modalService';
import Cookies from 'js-cookie';

let handlingJavascriptError = false;

export function showJavascriptErrorDialog(message, source, lineno?: number, colno?: number, error?: any) {
  const msg = error || message;
  console.error('Javascript Error:', msg);

  if (typeof msg === 'string' && msg.includes('ResizeObserver')) {
    return;
  }

  if (typeof msg === 'string' && msg.toLowerCase().includes('regular expression') && msg.toLowerCase().includes('invalid group')) {
    Cookies.set('avoid_wikitext_highlight', '1');
    return;
  }

  if (handlingJavascriptError) {
    return;
  }

  handlingJavascriptError = true;

  modalService.modal('Unexpected Error', `
    <p>
      An unexpected JavaScript error occurred. Try again in a few moments. If the problem
      persists then yell at kwwxis.
    </p>
  `).onClose(() => {
    handlingJavascriptError = false;
  })

  return true;
}

let handlingInternalError = false;

export function showInternalErrorDialog(data) {
  console.error('Internal Error:', data);

  if (handlingInternalError) {
    return;
  }

  handlingInternalError = true;

  modalService.modal('Internal Error', `
    <p>
      An internal server error occurred. Try again in a few moments. If the problem
      persists then yell at kwwxis.
    </p>
  `).onClose(() => {
    handlingInternalError = false;
  });

  return true;
}