import { html, css } from 'lit-element'
import { PageViewElement } from './page-view-element.js'
import { connect } from 'pwa-helpers/connect-mixin.js'
import { store } from '../store.js'
import { SharedStyles } from './shared-styles.js'
import {
    TYPE_FILE,
    STATE_ERROR,
    toggleCachedOnly,
    play,
    select,
    reload,
    next,
    last,
    pin
} from '../actions/player.js'
import {
    showSnackbar,
} from '../actions/app.js'
import {
    cachedOnlySelector,
    contentSelector,
    parentsSelector,
    currentFileSelector,
    isPlayingSelector,
    playerSourceSelector,
    lastPlayedSelector
} from '../reducers/player.js'

class MyView1 extends connect(store)(PageViewElement) {
    static get styles() {
        return [
            SharedStyles,
            css`
                .parent .name, .server {
                    font-weight: bold;
                }
                :host {
                    display: flex;
                    flex-direction: column;
                    font-family: system-ui;
                    width: 100%;
                }
                .controls, .entry {
                }
                .content {
                    overflow: auto;
                    flex:1;
                }
                .playing {
                    color: red;
                }
                .entry.parent {
                    background-color: #dddddd;
                }
                .entry {
                    box-sizing: border-box;
                    cursor: default;
                    position: relative;
                    
                    margin: 0.2em 0;
                    /*
                    padding: 0.5em;
                    */
                    width: 100%;
                    display: flex;
                    background-color: #eeeeee;
                    cursor: pointer;
                }
                .name {
                    flex: 1;
                    margin: 0.5em 0;
                    cursor: pointer;
                }
                .entry.File:before {
                    content: "🎵";
                    margin: 0.5em;
                }
                .entry.Directory:before {
                    content : "📁";
                    margin: 0.5em;
                }
                .entry.error:before {
                    content: "⚠";
                    margin: 0.5em;
                }
                .parent:before {
                    content: "📂";
                    margin: 0.5em;
                }
                .pinned {
                    margin: 0.5em;
                    opacity: 0.3;
                    cursor: pointer;
                }
                .pinned.YES {
                    opacity: 1;
                }
                .pinned.PARTIAL {
                    opacity: 0.6;
                }
                .cached {
                    color: beige;
                    margin: 0.5em;
                }
                @keyframes blinking{
                    0%{     opacity: 1;    }
                    49%{    opacity: 0.49; }
                    50%{    opacity: 0.5; }
                    99%{    opacity: 0.99;  }
                    100%{   opacity: 1;    }
                }
                
                .cached.YES {
                    color: green;
                }
                .cached.REQUESTED {
                    color: green;
                    animation: blinking 0.8s infinite
                }
                .cached.ERROR {
                    color: red;
                }
                .cached.PARTIAL {
                    color: darkseagreen;
                }
                .buttons {
                    display: flex;
                    justify-content: space-between;
                }
                .buttons > button {
                    flex:1;
                    cursor: pointer;
                }
                .button:last-child {
                    margin-right: 0;
                }
                .material-icons {
                    font-family: 'Material Icons';
                    font-weight: normal;
                    font-style: normal;
                    font-size: 36px;  /* Preferred icon size */
                    display: inline-block;
                    line-height: 1;
                    text-transform: none;
                    letter-spacing: normal;
                    word-wrap: normal;
                    white-space: nowrap;
                    direction: ltr;
                  
                    /* Support for all WebKit browsers. */
                    -webkit-font-smoothing: antialiased;
                    /* Support for Safari and Chrome. */
                    text-rendering: optimizeLegibility;
                  
                    /* Support for Firefox. */
                    -moz-osx-font-smoothing: grayscale;
                  
                    /* Support for IE. */
                    font-feature-settings: 'liga';
                  }
                .workaround {
                    width: 36px;
                    display: block;
                    margin: auto;
                }
            `
        ]
    }
    render() {
        return html`
            <div class="controls">
                <div class="buttons">
                    <button class="material-icons" @click=${this._homeClickHandler}>home</button>
                    <button class="material-icons" @click=${() => store.dispatch(last())}>skip_previous</button>
                    <button class="material-icons" @click=${this._togglePlaying}>${this._isPlaying ? "pause" : "play_arrow"}</button>
                    <button class="material-icons" @click=${() => store.dispatch(next())}>skip_next</button>
                    <button class="material-icons" @click=${() => store.dispatch(reload())}>refresh</button>
                    <button class="material-icons" @click=${this._toggleCachedOnly}><span class="workaround">${this._cachedOnly ? 'wifi_off' : 'wifi_on'}</span></button>
                </div>
                <audio
                    autoplay
                    @ended=${() => store.dispatch(next())}
                    src="${this._playerSourceSelector}">
                        Your browser does not support the
                        <code>audio</code> element.
                </audio>
                <div class="parents" @click=${this._parentClickHandler} >
                    ${this._parents.map((entry, idx) => html`
                        <div class="entry parent" name=${idx}>
                            <div class="name" >${entry.basename}</div>
                            <div class="cached ${entry.cached}">⬤</div>
                            <div class="pinned ${entry.pinned}">📌</div>
                        </div>
                    `)}
                </div>
            </div>
            <div class="content" @click=${this._contentClickHandler}>
                ${this._content.map((entry, idx) => html`
                    <div name=${idx} class="entry ${entry.type} ${entry.error ? 'error' : ''}">
                        <div class="name ${this._fileClass(entry)}">${entry.basename}</div>
                        <div class="cached ${entry.cached}">⬤</div>
                        <div class="pinned ${entry.pinned}">📌</div>
                    </div>
                `)}
            </div>
            
        `
    }
    
    static get properties() {
        return {
            _cachedOnly: { type: Boolean },
            _lastPlayed: { type: String },
            _currentFile: { type: String },
            _playerSourceSelector: { type: String },
            _content: { type: Array },
            _parents: { type: Array },
            _isPlaying: { type: Boolean }
        }
    }
    stateChanged(state) {
        this._lastPlayed = lastPlayedSelector(state)
        this._content = contentSelector(state)
        this._parents = parentsSelector(state)
        this._currentFile = currentFileSelector(state)
        this._playerSourceSelector = playerSourceSelector(state) || ''
        this._isPlaying = isPlayingSelector(state)
        this._cachedOnly = cachedOnlySelector(state)
    }
    updated(){
        if(this._isPlaying) this._getAudioNode().play()
        else this._getAudioNode().pause()
        if(this._lastPlayed) this.shadowRoot.querySelector('.playing').scrollIntoView({
            //behavior: 'smooth',
            block: 'center'
        })
    }
    _getAudioNode() {
        return this.shadowRoot.querySelector('audio')
    }
    _togglePlaying() {
        store.dispatch(play(!this._isPlaying))
    }
    _fileClass(entry) {
        return (this._lastPlayed == entry.id) ? 'playing' : ''
    }
    _getIdxFromEvt(evt){
        const path = evt.composedPath()
        const idx = path && (path[1] && path[1].getAttribute && path[1].getAttribute('name')) || path[0].getAttribute('name')
        if(idx != null) return Number(idx)

    }
    _getClassListFromEvt(evt){
        return evt.composedPath()[0].classList
    }
    _homeClickHandler(evt){
        //store.dispatch(selectFolder(''))
        window.location.hash = ''
        window.history.go(-window.history.length)
    }
    _toggleCachedOnly() {
        store.dispatch(toggleCachedOnly())
    }
    _parentClickHandler(evt){
        // TODO: search history
        const idx = this._getIdxFromEvt(evt)
        if(idx == null) return
        const entry = this._parents[idx]
        if(!this._pinCacheClickHandler(evt, entry)){
            const dHistory = idx - this._parents.length + 1
            window.history.go(dHistory)
            //window.location.hash = entry.name
            //store.dispatch(selectFolder(entry.name))
        }
    }
    _pinCacheClickHandler(evt, entry){
        const classes = this._getClassListFromEvt(evt)
        if(classes.contains('pinned')){
            store.dispatch(pin(entry))
            return true
        }
        if(classes.contains('cached')) {
            store.dispatch(pin(entry))
            return true
        }

    }
    _contentClickHandler(evt) {
        const idx = this._getIdxFromEvt(evt)
        if(idx == null) return
        const entry = this._content[idx]
        if(this._pinCacheClickHandler(evt, entry)) return
        if(evt.composedPath()[0].getAttribute('name') == idx) store.dispatch(showSnackbar(entry.error))
        else if(entry.type == TYPE_FILE) store.dispatch(select(entry.id))
        else window.location.hash = entry.id
        
    }
}

window.customElements.define('my-view1', MyView1);
