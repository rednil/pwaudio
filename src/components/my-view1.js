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
    pin
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
                overflow: hidden;
                flex-direction: column;
                height: 100%;
                font-family: system-ui;
                    
                }
                .controls, .entry {
                    max-width: 300px;
                }
                .content {
                    overflow: auto;
                }
                .playing {
                    color: red;
                }
                .folder, .file, .parent, .server {
                    width: 100%;
                    margin: 0.5em 0;
                    padding: 0.2em;
                    display: flex;
                    background-color: beige;
                }
                .entry {
                    cursor: default;
                }
                .name {
                    flex: 1;
                    margin: auto;
                    cursor: pointer;
                }
                .entry.file:before {
                    content : "🎵";
                    margin-right: 0.5em;
                }
                .entry.folder:before {
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
                .pinned.true {
                    opacity: 1;
                }
                .cached {
                    color: lightgrey;
                }
                .cached.true {
                    color: green;
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
                    @ended=${this._endedHandler}
                    src="${this._playerSourceSelector}">
                        Your browser does not support the
                        <code>audio</code> element.
                </audio>
            
                <div @click=${this._homeClickHandler} class="server">${this._server}</div>
                ${this._parents.map((folder, idx) => html`
                    <div class="parent" name=${idx}>
                        <div class="name" @click=${this._parentClickHandler} >${folder.basename}</div>
                        <!--
                        <div class="cached">⬤</div>
                        <div class="pinned">📌</div>
                        -->
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
        store.dispatch(setServer('http://localhost/'))
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
        //return (this._currentFile.search(entry.filename) >= 0) ? 'playing' : ''
        return (this._currentFile.slice(-entry.filename.length) == entry.filename) ? 'playing' : ''
    }
    _getIdxFromEvt(evt){
        return Number(evt.composedPath()[1].getAttribute('name'))
    }
    _getClassListFromEvt(evt){
        return evt.composedPath()[0].classList
    }
    _parentClickHandler(evt){
        const entry = this._parents[this._getIdxFromEvt(evt)]
        store.dispatch(selectFolder(entry.filename))
    }
    _contentClickHandler(evt) {
        console.log('_contentClickHandler', evt.composedPath()[0].className, '|', evt.composedPath()[1].className)
        const entry = this._content[this._getIdxFromEvt(evt)]
        const classes = this._getClassListFromEvt(evt)
        if(classes.contains('pinned') || classes.contains('cached')) {
            store.dispatch(pin(this._server + this._path + entry.filename, !entry.pinned))
        }
        else switch(entry.type) {
            case 'file': 
                store.dispatch(setCurrentFile(this._server + this._path + entry.filename))
                break
            case 'folder':
                store.dispatch(selectFolder(this._path + entry.filename))
                break
        } 
    }
}

window.customElements.define('my-view1', MyView1);
