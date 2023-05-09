import { Listener, startListeners } from '../../../util/eventLoader';
import Cookies from 'js-cookie';
import { flashTippy } from '../../../util/tooltips';
import {
  errorHtmlWrap,
  genshinEndpoints,
  SaccharoseApiEndpoint,
  starRailEndpoints,
  zenlessEndpoints,
} from '../../../endpoints';
import { pageMatch } from '../../../pageMatch';
import { HttpError } from '../../../../shared/util/httpError';

pageMatch('pages/generic/basic/olgen', () => {
  let endpoint: SaccharoseApiEndpoint<any>;
  let tlRmDisabled: boolean = false;
  let neverDefaultHidden: boolean = false;

  if (document.body.classList.contains('page--genshin')) {
    endpoint = genshinEndpoints.generateOL;
  } else if (document.body.classList.contains('page--hsr')) {
    endpoint = starRailEndpoints.generateOL;
    tlRmDisabled = true;
    neverDefaultHidden = true;
  } else if (document.body.classList.contains('page--zenless')) {
    endpoint = zenlessEndpoints.generateOL;
    tlRmDisabled = true;
    neverDefaultHidden = true;
  }

  function loadResultFromURL() {
    const url = new URL(window.location.href);
    const query = url.searchParams.get('q');
    window.history.replaceState({q: query}, null, window.location.href);
    if (query) {
      document.querySelector<HTMLInputElement>('.ol-input').value = query;
      generateResult(true);
    } else {
      document.querySelector<HTMLInputElement>('.ol-input').value = '';
    }
  }

  function loadResultFromState(state) {
    if (!state)
      state = {};
    document.querySelector<HTMLInputElement>('.ol-input').value = state.q || '';
    if (state.q) {
      generateResult(true);
    } else {
      document.querySelector('#ol-results-list').innerHTML = '';
    }
  }

  function generateResult(isNonUserAction: boolean = false) {
    let inputEl = document.querySelector<HTMLInputElement>('.ol-input');
    let buttonEl  = document.querySelector<HTMLButtonElement>('.ol-submit');
    let loadingEl = document.querySelector<HTMLElement>('.ol-submit-pending');
    let tlOptionValue = document.querySelector<HTMLInputElement>('input[type="radio"][name="tl_options"]:checked').value;
    let rmOptionValue = document.querySelector<HTMLInputElement>('input[type="radio"][name="rm_options"]:checked').value;
    let text = inputEl.value.trim();

    if (!text) {
      flashTippy(inputEl, {content: 'Enter a name first!', delay:[0,2000]});
      return;
    }

    loadingEl.classList.remove('hide');
    inputEl.disabled = true;
    buttonEl.disabled = true;

    const url = new URL(window.location.href);
    url.searchParams.set('q', text);
    if (isNonUserAction) {
      window.history.replaceState({q: text}, null, url.href);
    } else {
      window.history.pushState({q: text}, null, url.href);
    }

    endpoint.get({
      text,
      hideTl: tlRmDisabled || tlOptionValue === 'exclude_tl',
      addDefaultHidden: !neverDefaultHidden && tlOptionValue === 'exclude_tl',
      hideRm: tlRmDisabled || rmOptionValue === 'exclude_rm',
    }, true).then(result => {
      document.querySelector('#ol-results-list').innerHTML = result;
    }).catch((err: HttpError) => {
      if (err.type === 'NotFound') {
        document.querySelector('#ol-results-list').innerHTML = errorHtmlWrap('Not Found: ' + err.message);
      } else {
        document.querySelector('#ol-results-list').innerHTML = errorHtmlWrap(err.message);
      }
    }).finally(() => {
      loadingEl.classList.add('hide');
      inputEl.disabled = false;
      buttonEl.disabled = false;

      if (inputEl.value.trim().length) {
        document.querySelector('.ol-input-clear').classList.remove('hide');
      } else {
        document.querySelector('.ol-input-clear').classList.add('hide');
      }
    });
  }

  const listeners: Listener[] = [
    {
      ev: 'ready',
      fn: function() {
        loadResultFromURL();
      }
    },
    {
      el: 'window',
      ev: 'popstate', // user clicks browser back/forward buttons
      fn: function(event: PopStateEvent) {
        if (!event.state) {
          return;
        }
        console.log('[popstate] URL changed to', window.location.href, ' / state:', event.state);
        loadResultFromState(event.state);
      }
    },
    {
      el: '.ol-input',
      ev: 'enter',
      fn: function(_event, _target) {
        generateResult();
      }
    },
    {
      el: '.ol-input',
      ev: 'input',
      fn: function(_event, target: HTMLInputElement) {
        if (target.value.trim().length) {
          document.querySelector('.ol-input-clear').classList.remove('hide');
        } else {
          document.querySelector('.ol-input-clear').classList.add('hide');
        }
      }
    },
    {
      el: '.ol-input-clear',
      ev: 'click',
      fn: function(_event) {
        let inputEl = document.querySelector<HTMLInputElement>('.ol-input');
        inputEl.value = '';
        inputEl.focus();
        document.querySelector('.ol-input-clear').classList.add('hide');
      }
    },
    {
      el: 'input[type="radio"][name="tl_options"],input[type="radio"][name="rm_options"]',
      ev: 'input',
      multiple: true,
      fn: function(event, target: HTMLInputElement) {
        let name = target.name;
        let value = target.value;
        Cookies.set('OL.'+name, value, { expires: 365 });
      }
    },
    {
      el: '.ol-submit',
      ev: 'click',
      fn: function(_event, _target) {
        generateResult();
      }
    },
  ];

  startListeners(listeners);
});