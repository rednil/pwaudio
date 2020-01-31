/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

export const UPDATE_PAGE = 'UPDATE_PAGE';
export const UPDATE_OFFLINE = 'UPDATE_OFFLINE';
export const OPEN_SNACKBAR = 'OPEN_SNACKBAR';
export const CLOSE_SNACKBAR = 'CLOSE_SNACKBAR';

import { select, setServer } from './player.js'

export const navigate = (path) => (dispatch) => {
  // Extract the page name from path.
  //if(path == '/') return window.location.replace(window.location.href + 'player')
  const page = path === '/' ? 'player' : path.slice(1);
  // Any other info you might want to extract from the path (like page type),
  // you can do here
  dispatch(loadPage(page))
};

const loadPage = (page) => (dispatch) => {
  switch(page) {
    case 'player':
      import('../components/pwa-player.js').then((module) => {
        // Put code in here that you want to run every time when
        // navigating to view1 after my-view1.js is loaded.
        //console.log('hash', decodeURIComponent(window.location.hash))
        const hash = window.location.hash.slice(1)
        if(hash && !isNaN(hash)) dispatch(select(Number(hash)))
        else {
            const {protocol, hostname, port} = window.location
            const server = ''//(port == 3000) ? `${protocol}//${hostname}:3001` : ''
            dispatch(setServer(server + '/api/v1/fs/'))
        }
      })
      break;
    case 'settings':
      import('../components/pwa-settings.js');
      break;
    default:
      page = 'view404';
      import('../components/my-view404.js');
  }

  dispatch(updatePage(page));
};

const updatePage = (page) => {
  return {
    type: UPDATE_PAGE,
    page
  };
};

let snackbarTimer;

export const showSnackbar = (msg) => (dispatch) => {
  dispatch({
    type: OPEN_SNACKBAR,
    msg
  })
  window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() =>
    dispatch({ type: CLOSE_SNACKBAR }), 3000)
};

export const updateOffline = (offline) => (dispatch, getState) => {
  // Show the snackbar only if offline status changes.
  if (offline !== getState().app.offline) {
    dispatch(showSnackbar(`You are now ${offline ? 'offline' : 'online'}.`));
  }
  dispatch({
    type: UPDATE_OFFLINE,
    offline
  });
};

export const updateLayout = (wide) => (dispatch, getState) => {
  console.log(`The window changed to a ${wide ? 'wide' : 'narrow'} layout`);
};
