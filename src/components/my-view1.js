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
    next,
    last
} from '../actions/player.js'
import player, { 
    contentSelector,
    parentsSelector,
    serverSelector,
    currentFileSelector,
    pathSelector,
    isPlayingSelector
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

                .name {
                    flex: 1;
                    margin: auto;
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
                }
                .cached {
                    color: lightgrey;
                }
                .cached.yes {
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
                <audio
                    autoplay
                    @ended=${this._endedHandler}
                    src="${this._currentFile}">
                        Your browser does not support the
                        <code>audio</code> element.
                </audio>
            
                <div @click=${this._homeClickHandler} class="server">${this._server}</div>
                ${this._parents.map((folder, idx) => html`
                    <div class="parent">
                        <div class="name" @click=${this._parentClickHandler} name=${idx}>${folder.basename}</div>
                        <div class="cached">⬤</div>
                        <div class="pinned">📌</div>
                    </div>
                `)}
            </div>
            <div class="content" @click=${this._contentClickHandler}>
                ${this._content.map((entry, idx) => html`
                    <div class="entry ${entry.type}">
                        <div class="name ${this._fileClass(entry)}" name=${idx}>${entry.basename}</div>
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
        this._currentFile = ''
    }
    static get properties() {
        return {
            _path: { type: String },
            _currentFile: { type: String },
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
        return (this._currentFile.search(entry.filename) >= 0) ? 'playing' : ''
    }
    _getIdxFromEvt(evt){
        return Number(evt.composedPath()[0].getAttribute('name'))
    }
    _parentClickHandler(evt){
        const entry = this._parents[this._getIdxFromEvt(evt)]
        store.dispatch(selectFolder(entry.filename))
    }
    _contentClickHandler(evt) {
        const entry = this._content[this._getIdxFromEvt(evt)]
        switch(entry.type) {
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
