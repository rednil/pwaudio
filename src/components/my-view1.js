import { html, css } from 'lit-element'
import { PageViewElement } from './page-view-element.js'
import { connect } from 'pwa-helpers/connect-mixin.js'
import { store } from '../store.js'
import { SharedStyles } from './shared-styles.js'
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
import player, {
    contentSelector,
    parentsSelector,
    serverSelector,
    currentFileSelector,
    pathSelector,
    isPlayingSelector,
    playerSourceSelector
} from '../reducers/player.js'

store.addReducers({
  player
})

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
                    max-width: 300px;
                }
                .content {
                    overflow: auto;
                    flex:1;
                }
                .playing {
                    color: red;
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
                }
                .entry.File:before {
                    content : "🎵";
                    margin-right: 0.5em;
                }
                .entry.Directory:before {
                    content : "🗀";
                    margin-right: 0.5em;
                }
                .parent:before {
                    content: "🗁";
                    margin-right: 0.5em;
                }
                .pinned {
                    opacity: 0.3;
                    cursor: pointer;
                }
                .pinned.UNKNOWN:before, .cached.UNKNOWN:before {
                    content: "?";
                    position: absolute;
                    margin-left: 0.5em;
                    color:black;

                }
                .pinned.undefined:before, .cached.undefined:before {
                    content: "!";
                    position: absolute;
                    margin-left: 0.5em;
                    color: black;
                }
                .pinned.YES {
                    opacity: 1;
                }
                .pinned.PARTIAL {
                    opacity: 0.5;
                }
                .cached {
                    color: lightgrey;
                }
                .cached.YES {
                    color: green;
                }
                .cached.PARTIAL {
                    color: darkseagreen;
                }
            `
        ]
    }
    render() {
        return html`
            <div class="controls">
                <button @click=${() => store.dispatch(last())}>⏮</button>
                <button @click=${this._togglePlaying}>${this._isPlaying ? "⏸" : "▶️"}</button>
                <button @click=${() => store.dispatch(next())}>⏭</button>
                <button @click=${() => store.dispatch(reload())}>↻</button>
                <audio
                    autoplay
                    @ended=${() => store.dispatch(next())}
                    src="${this._playerSourceSelector}">
                        Your browser does not support the
                        <code>audio</code> element.
                </audio>
            
                <div @click=${this._homeClickHandler} class="server">${this._server}</div>
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
                    <div name=${idx} class="entry ${entry.type}">
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
        store.dispatch(setServer('http://192.168.1.43:3001/'))
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
