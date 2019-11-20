import { html, css } from 'lit-element'
import { PageViewElement } from './page-view-element.js'
import { connect } from 'pwa-helpers/connect-mixin.js'
import { store } from '../store.js'
import { SharedStyles } from './shared-styles.js'
import '@material/mwc-icon-button'
import { 
    selectFolder, 
    setServer,
    setCurrentFile,
    play,
    reload,
    next,
    last,
    pin,
    STATE_YES,
    STATE_NO,
    STATE_PARTIAL,
    STATE_UNKNOWN
} from '../actions/player.js'
import {
    contentSelector,
    parentsSelector,
    serverSelector,
    currentFileSelector,
    pathSelector,
    isPlayingSelector,
    playerSourceSelector
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
                .entry, .parent {
                    box-sizing: border-box;
                }
                .Directory, .File, .parent, .server {
                    width: 100%;
                    margin: 0.5em 0;
                    padding: 0.2em;
                    display: flex;
                    background-color: beige;
                    cursor: pointer;
                }
                .entry {
                    cursor: default;
                    position: relative;
                }
                .name {
                    flex: 1;
                    margin: auto;
                    cursor: pointer;
                    margin-right: 1em;
                }
                .entry.File:before {
                    content: "🎵";
                    margin-right: 0.5em;
                }
                .entry.error:before {
                    content: "⚠";
                }
                .entry.Directory:before {
                    content : "📁";
                    margin-right: 0.5em;
                }
                .parent:before {
                    content: "📂";
                    margin-right: 0.5em;
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
                .cached.YES {
                    color: green;
                }
                .cached.PARTIAL {
                    color: darkseagreen;
                }
                .buttons {
                    display: flex;
                    justify-content: space-between;
                }
                .button:last-child {
                    margin-right: 0;
                }
            `
        ]
    }
    render() {
        return html`
            <div class="controls">
                <div class="buttons">
                    <mwc-icon-button raised icon="home" @click=${this._homeClickHandler}></mwc-icon-button>
                    <mwc-icon-button raised icon="skip_previous" @click=${() => store.dispatch(last())}></mwc-icon-button>
                    <mwc-icon-button raised icon="${this._isPlaying ? "pause" : "play_arrow"}" @click=${this._togglePlaying}></mwc-icon-button>
                    <mwc-icon-button raised icon="skip_next" @click=${() => store.dispatch(next())}></mwc-icon-button>
                    <mwc-icon-button raised icon="refresh" @click=${() => store.dispatch(reload())}></mwc-icon-button>
                </div>
                <audio
                    autoplay
                    @ended=${() => store.dispatch(next())}
                    src="${this._playerSourceSelector}">
                        Your browser does not support the
                        <code>audio</code> element.
                </audio>
                ${this._parents.map((folder, idx) => html`
                    <div class="parent" name=${idx}>
                        <div class="name" @click=${this._parentClickHandler} >${folder.basename}</div>
                        ${idx == this._parents.length-1 ? html`
                            <div class="cached ${folder.cached}">⬤</div>
                            <div class="pinned ${folder.pinned}">📌</div>
                        ` : ''}
                    </div>
                `)}
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
    constructor() {
        super()
        //store.dispatch(setServer('http://192.168.1.43:3001/fs/Walter Moers/'))
        //store.dispatch(setServer('http://audio.chr.ddnss.de/media/'))
        store.dispatch(setServer((window.location.hostname == 'localhost') ? 'http://localhost:3001/fs/' : '/fs/'))
        this._playerSourceSelector = ''
    }
    static get properties() {
        return {
            _path: { type: String },
            _currentFile: { type: String },
            _playerSourceSelector: { type: String },
            _content: { type: Array },
            _parents: { type: Array },
            _isPlaying: { type: Boolean }
        }
    }
    stateChanged(state) {
        this._content = contentSelector(state)
        this._parents = parentsSelector(state)
        this._server = serverSelector(state)
        this._currentFile = currentFileSelector(state)
        this._playerSourceSelector = playerSourceSelector(state)
        this._path = pathSelector(state)
        this._isPlaying = isPlayingSelector(state)
    }
    updated(){
        if(this._isPlaying) this._getAudioNode().play()
        else this._getAudioNode().pause()
    }
    _getAudioNode() {
        return this.shadowRoot.querySelector('audio')
    }
    _togglePlaying() {
        store.dispatch(play(!this._isPlaying))
    }
    _fileClass(entry) {
        //return (this._currentFile.search(entry.name) >= 0) ? 'playing' : ''
        return (this._currentFile.slice(-entry.name.length) == entry.name) ? 'playing' : ''
    }
    _getIdxFromEvt(evt){
        return Number(evt.composedPath()[1].getAttribute('name'))
    }
    _getClassListFromEvt(evt){
        return evt.composedPath()[0].classList
    }
    _homeClickHandler(evt){
        store.dispatch(selectFolder(''))
    }
    _parentClickHandler(evt){
        const entry = this._parents[this._getIdxFromEvt(evt)]
        store.dispatch(selectFolder(entry.name))
    }
    _contentClickHandler(evt) {
        const entry = this._content[this._getIdxFromEvt(evt)]
        const classes = this._getClassListFromEvt(evt)
        if(classes.contains('pinned') || classes.contains('cached')) {
            store.dispatch(pin(this._server + this._path + entry.name, !(entry.pinned == STATE_YES)))
        }
        else switch(entry.type) {
            case 'File': 
                store.dispatch(setCurrentFile(this._server + this._path + entry.name))
                break
            case 'Directory':
                store.dispatch(selectFolder(this._path + entry.name))
                break
        } 
    }
}

window.customElements.define('my-view1', MyView1);
