export const SELECT_FOLDER = 'SELECT_FOLDER'
export const SET_FOLDER_CONTENT = 'SET_FOLDER_CONTENT'
export const SELECT_FILE = 'SELECT_FILE'
export const SET_SERVER = 'SET_SERVER'
export const SET_PLAYING = 'SET_PLAYING'
export const SET_CURRENT_FILE = 'SET_CURRENT_FILE'
import {
    serverSelector,
    currentFileSelector
} from '../reducers/player.js'

export const selectFolder = (path) => (dispatch, getState) => {
    dispatch({
        type: SELECT_FOLDER,
        path
    })
    getDirectoryContent(serverSelector(getState()) + path)
    .then(response => dispatch({
        type: SET_FOLDER_CONTENT,
        path,
        response
    }))
}

async function getDirectoryContent(url) {
    if(url.slice(-1) != '/') url += '/'
    const response = await fetch(url, { method: 'GET' })
    const text = await response.text()
    return text
    .replace(/.*Parent Directory.*/,'')
    .match(/href="[^"]+/g)
    .map(entry => decodeURI(entry.slice(6)))
}

export const play = (bool) => {
    return {
        type: SET_PLAYING,
        bool
    }
}

export const selectFile = (url) => {
  return {
    type: SELECT_FILE,
    url
  }
}

export const setServer = (server) => (dispatch) => {
    dispatch({
        type: SET_SERVER,
        server
    })
    dispatch(selectFolder(''))
}

export const setCurrentFile = (filename) => {
    return {
        type: SET_CURRENT_FILE,
        filename
    }
}

/*
function getParentDirectoryContent(url) {
    
    return getDirectoryContent(arr.join('/'))
}
*/


const skip = (d) => () => (dispatch, getState) => {
    const current = currentFileSelector(getState())
    const parents = current.split('/')
    const filename = parents.pop()
    const parentPath = parents.join('/') + '/'
    getDirectoryContent(parentPath)
    .then(content => {
        const files = content.filter(str => str.slice(-1) != '/')
        const idx = files.indexOf(filename)
        const newIdx = idx + d
        if(newIdx >=0 && newIdx < files.length) dispatch(setCurrentFile(parentPath + files[newIdx]))
    })
}
export const next = skip(1)
export const last = skip(-1)
/*
async _readdir(path){
    console.log('_readdir', this._path)
    const response = await fetch(graphQlRoot, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({query:`{directory(path:"/${this._path.join('/')}"){folders\nfiles}}`})
    })
    const json = await response.json()
    //
    console.log(json.data.directory)
    this._files = json.data.directory.files
    this._folders = json.data.directory.folders
    console.log('bulkGet', db.blobs.bulkGet, db.blobs.bulkDelete)
    this._refreshFilesMeta()
    
    console.log('this._fileStatus', this._fileStatus)
}
*/