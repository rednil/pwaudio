/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import { html, css } from 'lit-element';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import { increment, decrement } from '../actions/counter.js';

// We are lazy loading its reducer.
import counter from '../reducers/counter.js';
store.addReducers({
  counter
});

// These are the elements needed by this element.
import './counter-element.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class MyView2 extends connect(store)(PageViewElement) {
  static get properties() {
    return {
      // This is the data from the store.
      _clicks: { type: Number },
      _value: { type: Number }
    };
  }

  static get styles() {
    return [
      SharedStyles,
      css`
        :host {
            flex-direction: column;
            flex: 1;
        }
        .head {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            
        }
        
        button, select {
            cursor: pointer;
            height: 1.5em;
            font-size: 2em;  
        }
        .head .label {
            margin: auto 2rem;
            font-size: 2em; 
        }
        .canvas {
            display: flex;
            flex:1;
            margin: auto;
        }
        .content {
            display: flex;
            flex-direction: column;
            justify-content: space-around;
        }
        .content > div {
            display: flex;
            flex-direction: column;
        }
      `
    ]
  }

  render() {
    return html`
        <div class="head">
            <a href="player"><button class="material-icons">menu_open</button></a>
            <div class="label">Settings</div>
        </div>
        <div class="canvas">
            <div class="content">
                <div>
                    <label for="reset">Clear Cache</label>
                    <button id="reset">Reset</button>
                </div>
                <div>
                    <label for="cachesize">Cache Size</label>
                    <select id="cachesize" >
                        <option>500 MB</option>
                    </select>
                </div>
            </div>
        </div>
    `;
  }

  _counterIncremented() {
    store.dispatch(increment());
  }

  _counterDecremented() {
    store.dispatch(decrement());
  }

  // This is called every time something is updated in the store.
  stateChanged(state) {
    this._clicks = state.counter.clicks;
    this._value = state.counter.value;
  }
}

window.customElements.define('my-view2', MyView2);
