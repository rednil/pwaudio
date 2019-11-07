export const SELECT_FOLDER = 'SELECT_FOLDER'
export const SET_FOLDER_CONTENT = 'SET_FOLDER_CONTENT'
export const SELECT_FILE = 'SELECT_FILE'
export const SET_PLAYER_SOURCE = 'SET_PLAYER_SOURCE'
export const SET_SERVER = 'SET_SERVER'
export const SET_PLAYING = 'SET_PLAYING'
export const SET_CURRENT_FILE = 'SET_CURRENT_FILE'
import Dexie from 'dexie'
import {
    serverSelector,
    currentFileSelector,
    folderUrlSelector,
    pathSelector
} from '../reducers/player.js'

const separator = ' - '

const db = new Dexie('pwa-music-player')
db.version(1).stores({
    cache: `url, created, pinned, cached`
})

export const selectFolder = (path, discardCache) => (dispatch, getState) => {
    console.log('selectFolder', path)
    dispatch({
        type: SELECT_FOLDER,
        path,
        parents: getParentLinks(path)
    })
    get(serverSelector(getState()) + path, discardCache)
    .then(content => dispatch({
        type: SET_FOLDER_CONTENT,
        path,
        content
    }))
}
export const reload = () => (dispatch, getState) => {
    console.log('reload')
    dispatch(selectFolder(pathSelector(getState()), true))
}

function isFolder(url) {
    return url.slice(-1) == '/'
}
export const pin = (url, pinned) => async function(dispatch) {
    if(isFolder(url)) pinFolder(url, pinned, dispatch)
    else pinFile(url, pinned, dispatch)
}
async function pinFile(url, pinned, dispatch){
    await updateCache(url, {pinned})
    await updateEntryProp(url, 'pinned', pinned)
    dispatch(refresh(url))    
}
async function pinFolder(url, pinned, dispatch) {
    //const parentDir = getParentDir(url)
    const content = await get(url)
    console.log('pinFolder', content, pinned)
    content.map(entry => dispatch(pin(url + entry.filename, pinned)))
}
async function get(url, discardCache) {
    console.log('get', url)
    let content
    try{
        if(discardCache) throw('refresh')
        let cached = await db.cache.get(url)
        content = cached.content
        if(!content) throw('no content')
        console.log('cache', url, content)
    } catch(e) {
        console.log('catch', url, e)
        if(isFolder(url)) {
            console.log('fetch dir', url)
            let response = await fetch(url, { method: 'GET' })
            content = await webDavResponseToJson(url, response)
        }
        else {
            content = await fetchBlob(url)
            await updateEntryProp(url, 'cached', true)
        }
        if(content) await updateCache(url, {content, cached: true})
    }
    return content
}
async function updateEntryProp(url, prop, value) {
    console.log('updateEntryProp', url, prop, value)
    const parentDir = getParentDir(url)
    let content = await get(parentDir)
    const filename = url.split('/').pop()
    return db.transaction('rw!', db.cache, async () => {
        const cacheItem = await db.cache.get(parentDir)
        const entry = cacheItem.content.find(candidate => candidate.filename == filename)
        entry[prop] = value
        console.log('updateEntryProp put', cacheItem)
        await db.cache.put(cacheItem)
    })
}
const getParentDir = (url) => {
    const arr = url.replace(/\/$/, '').split('/')
    arr.pop()
    return arr.join('/') + '/'
}
async function fetchBlob(url) {
    console.log('fetchBlob', url)
	return new Promise((resolve, reject) => {
	    var xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.responseType = 'blob'
        xhr.onload = function() {
            if (this.status == 200) {
                var blob = new Blob([this.response], { type: 'image/png' })
                console.log('blob ready')
                resolve(blob)
            }
            else {
                reject(`XMLHttpRequest Status ${this.status}` )
                console.error(`XMLHttpRequest Status ${this.status}`)
            }
        }
        xhr.onerror = function(error) {
            reject(error)
            console.error(`XMLHttpRequest Error ${this.status}`)
        }
        xhr.send()
    })
}
const getEmptyItem = (url) => {
    return {
        url,
        cached: false,
        pinned: false,
        created: new Date().getTime()
    }
}
async function updateCache(url, obj) {
    return db.transaction('rw!', db.cache, () => {
        return db.cache.get(url)
        .then((item = getEmptyItem(url)) => {
            console.log('udpateCache', item, obj)
            return db.cache.put(Object.assign(item, obj))
        })
    })
}
async function webDavResponseToJson(url, response) {
    const text = await response.text()
    // TODO need path relative to root, not to server
    const path = url.replace(/http[s]?:\/\/[^\/]*/,'').replace(/&amp;/g, '&')
    console.log('path', path)
    const remove = path.split('/').join(separator)
    const parentDirRemover = getParentStringRemover(remove)
    const content = text
    .replace(/.*Parent Directory.*/,'')
    .match(/href="[^"]+/g)
    .map(entry => {
        const filename = decodeURI(entry.slice(6)).replace(/&amp;/g, '&')
        return {
            filename,
            basename: parentDirRemover(filename),
            type: entry.match(/\/$/) ? 'folder' : 'file'
    }})
    const files = content.filter(entry => entry.type == 'file')
    await Promise.allSettled(files.map(entry => {
        const fileUrl = url + entry.filename
        return Promise.all([isPinned(fileUrl), isCached(fileUrl)])
        .then(([pinned, cached]) => {
            entry.cached = cached
            entry.pinned = pinned
            console.log('file', url+entry.filename, 'cached', cached, 'pinned' , pinned)
        })
    }))
    console.log('cache update done')
    return content
}

async function isPinned(url){
    const n = await db.cache.where('url').equals(url).and(entry => entry.pinned == true).count()
    return n ? true : false
}
async function isCached(url){
    const n = await db.cache.where('url').equals(url).and(entry => entry.cached == true).count()
    return n ? true : false
}


const getParentLinks = path => {
    const relPath = path.replace(/^\//, '').replace(/\/$/, '')
    const arr = (relPath == '') ? [] : relPath.split('/')
    return arr.map((folder, idx) => { return {
        filename: arr.slice(0, idx+1).join('/')+'/',
        basename: getParentStringRemover(arr.slice(0, idx).join(separator))(folder)
    }})
}

function getParentStringRemover(parentString = '') {
    const stringsToRemove = parentString.split(separator)
    return (from) => removeStrings(from, stringsToRemove).replace(/\/$/, '')
}
  
function removeStrings(from, stringsToRemove) {
    stringsToRemove.forEach(stringToRemove => {
        from = from.replace(stringToRemove, '')
    })
    return from.replace(/^[ -]*/,'')
}

export const play = (bool) => {
    return {
        type: SET_PLAYING,
        bool
    }
}



export const setServer = (server) => (dispatch) => {
    dispatch({
        type: SET_SERVER,
        server
    })
    dispatch(selectFolder(''))
}

const refresh = (url) => (dispatch, getState) => {
    if(!isFolder(url)) url = getParentDir(url)
    console.log('check folder update required', url, folderUrlSelector(getState()))
    if(url == folderUrlSelector(getState())) {
        dispatch(selectFolder(pathSelector(getState())))
    }
}

export const setCurrentFile = (url) => (dispatch) => {
    get(url).then(blob => {
        dispatch(refresh(url))
        dispatch({
            type: SET_PLAYER_SOURCE,
            url: window.URL.createObjectURL(blob)
        })
    })
    dispatch({
        type: SET_CURRENT_FILE,
        url
    })
}

const skip = (d) => () => (dispatch, getState) => {
    const current = currentFileSelector(getState())
    const parents = current.split('/')
    const filename = parents.pop()
    const parentPath = parents.join('/') + '/'
    get(parentPath)
    .then(content => {
        const entries = content.filter(entry => entry.type == 'file')
        const idx = entries.findIndex(entry => entry.filename == filename)
        const newIdx = idx + d
        if(newIdx >=0 && newIdx < entries.length) dispatch(setCurrentFile(parentPath + entries[newIdx].filename))
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