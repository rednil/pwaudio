/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import { LitElement, html, css } from 'lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { installMediaQueryWatcher } from 'pwa-helpers/media-query.js';
import { installOfflineWatcher } from 'pwa-helpers/network.js';
import { installRouter } from 'pwa-helpers/router.js';
import { updateMetadata } from 'pwa-helpers/metadata.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import {
  navigate,
  updateOffline,
  updateLayout
} from '../actions/app.js';
import { 
    downloadMissing
} from '../actions/player.js'
// These are the elements needed by this element.
import './snack-bar.js'

import player from '../reducers/player.js'

store.addReducers({
  player
})

class MyApp extends connect(store)(LitElement) {
  static get properties() {
    return {
      appTitle: { type: String },
      _page: { type: String },
      _snackbarOpened: { type: Boolean },
      _offline: { type: Boolean }
    };
  }

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        header {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .toolbar-list > a {
          display: inline-block;
          color: black;
          text-decoration: none;
          padding: 0 8px;
        }

        .toolbar-list > a[selected] {
          font-weight: bold;
        }

        /* Workaround for IE11 displaying <main> as inline */
        main {
          display: flex;
          width: 100%;
        }

        .page {
          display: none;
        }

        .page[active] {
          display: flex;
        }

        footer {
          border-top: 1px solid #ccc;
          text-align: center;
        }

        /* Wide layout */
        @media (min-width: 460px) {
          header {
            flex-direction: row;
          }
        }
      `
    ];
  }

  render() {
    // Anything that's related to rendering should be done in here.
    return html`
      <!-- Main content -->
      <main role="main" class="main-content">
        <my-view1 class="page" ?active="${this._page === 'player'}"></my-view1>
        <my-view2 class="page" ?active="${this._page === 'view2'}"></my-view2>
        <my-view3 class="page" ?active="${this._page === 'view3'}"></my-view3>
        <my-view404 class="page" ?active="${this._page === 'view404'}"></my-view404>
      </main>

     
      <snack-bar ?active="${this._snackbarOpened}">
        You are now ${this._offline ? 'offline' : 'online'}.
      </snack-bar>
    `;
  }

  firstUpdated() {
    installRouter((location) => store.dispatch(navigate(decodeURIComponent(location.pathname))));
    installOfflineWatcher((offline) => store.dispatch(updateOffline(offline)));
    installMediaQueryWatcher(`(min-width: 460px)`,
        (matches) => store.dispatch(updateLayout(matches)));
  }

  updated(changedProps) {
    if(changedProps.has('_offline') && !this._offline) {
        store.dispatch(downloadMissing())
    }
  }

  stateChanged(state) {
    this._page = state.app.page
    this._offline = state.app.offline
    this._snackbarOpened = state.app.snackbarOpened
  }
}

window.customElements.define('my-app', MyApp)
