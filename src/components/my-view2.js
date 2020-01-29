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
import { store } from '../store.js'

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

import {
    clearCache,
    queryCacheSize,
    setMaxCacheSize
} from '../actions/player.js'

import {
    cacheSizeSelector,
    maxCacheSizeSelector
} from '../reducers/player.js'

const kb = 1000
const mb = 1000000
const gb = 1000000000
const options = [100*mb, 500*mb, 1*gb, 2*gb, 5*gb]
class MyView2 extends connect(store)(PageViewElement) {
  static get properties() {
    return {
      // This is the data from the store.
      _cacheSize: { type: Number },
      _maxCacheSize: { type: Number }
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
        .current-cache-size {
            display: flex;
        }
        .current-cache-size span {
            font-size: 2em;
            margin-right: 1em;
        }
      `
    ]
  }

  render() {
    return html`
        <div class="head">
            <a href="javascript:history.back()"><button class="material-icons">menu_open</button></a>
        </div>
        <div class="canvas">
            <div class="content">
                <div>
                    <label for="cachesize">Max Cache Size</label>
                    <select @change=${this._setMaxCacheSize} id="cachesize" >
                        ${options.map(option => html`
                            <option ?selected=${this._maxCacheSize == option}>${this._beautify(option)}</option>
                        `)}
                    </select>
                </div>
                <div>
                    <label>Current Cache Size</label>
                    <div class="current-cache-size">
                        <span>${this._beautify(this._cacheSize)}</span>
                        <button @click=${this._reset} class="material-icons" id="reset">delete_forever</button>
                    </div>
                </div>
                
            </div>
        </div>
    `;
  }

  _reset() {
    store.dispatch(clearCache())
  }
  constructor(){
      super()
      store.dispatch(queryCacheSize())
  }
  _setMaxCacheSize(evt) {
    const size = options[evt.path[0].selectedIndex]
    store.dispatch(setMaxCacheSize(size))
  }
  _beautify(size) {
      if (size < kb) return size + ' Bytes'
      if (size < mb) return Math.round(size/kb) + ' KB'
      if (size < gb) return Math.round(size/mb) + ' MB'
      return Math.round(size/gb) + ' GB'
  }

  // This is called every time something is updated in the store.
  stateChanged(state) {
    this._cacheSize = cacheSizeSelector(state)
    this._maxCacheSize = maxCacheSizeSelector(state)
  }
}

window.customElements.define('my-view2', MyView2);
