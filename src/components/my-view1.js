import { html, css } from 'lit-element'
import { PageViewElement } from './page-view-element.js'
import { connect } from 'pwa-helpers/connect-mixin.js'
import { store } from '../store.js'
import { SharedStyles } from './shared-styles.js'
import {
    TYPE_FILE,
    TYPE_FOLDER,
    STATE_ERROR,
    toggleCachedOnly,
    play,
    select,
    reload,
    next,
    last,
    pin,
    setTimer,
    toggleIndex
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
    lastPlayedSelector,
    timerSelector,
    timeRemainingSelector,
    indexSelector,
    indexIdSelector
} from '../reducers/player.js'

class MyView1 extends connect(store)(PageViewElement) {
    static get styles() {
        return [
            SharedStyles,
            css`
                .parents .entry .name, .server {
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
                .parents .entry {
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
                .parents .entry:before {
                    content: "📂";
                    margin: 0.5em;
                }
                .icon {
                    margin: 0.5em;
                }
                .index {
                    margin: 0.5em;
                    max-height: 10em;
                    overflow: auto;
                }
                .pinned {
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
                    height: 1.5em;
                    font-size: 2em;  /* Preferred icon size */
                    
                }
                .button:last-child {
                    margin-right: 0;
                }
                .material-icons {
                    font-family: 'Material Icons';
                    font-weight: normal;
                    font-style: normal;
                    
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
                    width: 1em;
                    display: block;
                    margin: auto;
                }
                .timer {
                    display: flex;
                }
                .timer > span {
                    margin: auto;
                }
                button.play {
                    flex: 2;
                }
                .timer .remaining {
                    font-size: 0.5em;
                }
                @media only screen and (max-width: 600px) {
                    .buttons > button {
                        font-size: 1.5em;
                        height: 2em;
                    }
                }
                .offline {
                    color: red;
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
                    <button class="play material-icons" @click=${this._togglePlaying}>${this._isPlaying ? "pause" : "play_arrow"}</button>
                    <button class="timer" @click=${this._toggleTimer}>
                        <span class="material-icons">${this._timer ? 'timer' : 'timer_off'}</span>
                        ${this._timer ? html`<span class="remaining">${this._timeRemaining}m</span>` : ''}
                    </button>
                    <button class="material-icons" @click=${() => store.dispatch(next())}>skip_next</button>
                    <button class="material-icons" @click=${() => store.dispatch(reload())}>refresh</button>
                    <button class="material-icons ${this._offline ? 'offline' : ''}" @click=${this._toggleCachedOnly}><span class="workaround">${this._cachedOnly ? 'wifi_off' : 'wifi_on'}</span></button>
                </div>
                <audio
                    autoplay
                    @ended=${() => store.dispatch(next())}
                    src="${this._playerSourceSelector}">
                        Your browser does not support the
                        <code>audio</code> element.
                </audio>
                <div class="parents" @click=${this._parentClickHandler} >
                    ${this._parents.map(this.renderEntry.bind(this))}
                </div>
            </div>
            <div class="content" @click=${this._contentClickHandler}>
                ${this._content.map(this.renderEntry.bind(this))}
            </div>
            
        `
    }

    renderEntry(entry, idx) {
        return html`
            <div name=${idx} class="entry ${entry.type} ${entry.error ? 'error' : ''}">
                <div class="name ${this._fileClass(entry)}">${entry.basename}</div>
                ${this._cachedOnly ? '' : html`
                    ${entry.index ? html`<div class="icon info">🛈</div>` : ''}
                    <div class="icon cached ${entry.cached}">⬤</div>
                    <div class="icon pinned ${entry.pinned}">📌</div>
                `}
            </div>
            ${entry.index && (entry.id == this._indexId && !this._cachedOnly) ? html`<div class="index">${html([this._index.replace(/\n/g, '<br/>')])}</div>` : ''}
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
            _isPlaying: { type: Boolean },
            _timer: { type: Number },
            _timeRemaining: { type: Number },
            _index: { type: String },
            _indexId: { type: Number }
        }
    }
    stateChanged(state) {
        this._lastPlayed = lastPlayedSelector(state)
        this._content = contentSelector(state)
        this._parents = parentsSelector(state)
        this._currentFile = currentFileSelector(state)
        this._playerSourceSelector = playerSourceSelector(state) || ''
        this._isPlaying = isPlayingSelector(state)
        this._cachedOnly = cachedOnlySelector(state) || state.app.offline
        this._timer = timerSelector(state)
        this._timeRemaining = timeRemainingSelector(state)
        this._offline = state.app.offline,
        this._index = indexSelector(state)
        this._indexId = indexIdSelector(state)
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
        window.location.hash = ''
        window.history.go(-window.history.length)
    }
    _toggleCachedOnly() {
        if(this._offline) dispatch(showSnackbar('Your are offline!'))
        else store.dispatch(toggleCachedOnly())
    }
    _parentClickHandler(evt){
        // TODO: search history
        const idx = this._getIdxFromEvt(evt)
        if(idx == null) return
        const entry = this._parents[idx]
        if(!this._pinCacheClickHandler(evt, entry)){
            const dHistory = idx - this._parents.length + 1
            window.history.go(dHistory)
        }
    }
    _toggleTimer(){
        let newTimer = 0
        if(!this._timer) newTimer = timers[1]
        else if (this._timeRemaining != this._timer) newTimer = this._timer
        else {
            const idx = timers.indexOf(this._timer) + 1
            newTimer = timers[idx >= timers.length ? 0 : idx]
        }
        store.dispatch(setTimer(newTimer))

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
        if(classes.contains('info')) {
            store.dispatch(toggleIndex(entry))
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
const timers = [0, 15, 30, 60]
window.customElements.define('my-view1', MyView1)
