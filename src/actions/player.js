export const SELECT_FOLDER = 'SELECT_FOLDER'
export const SET_DIRECTORY = 'SET_DIRECTORY'
export const SELECT_FILE = 'SELECT_FILE'
export const SET_PLAYER_SOURCE = 'SET_PLAYER_SOURCE'
export const SET_SERVER = 'SET_SERVER'
export const SET_PLAYING = 'SET_PLAYING'
export const SET_CURRENT_FILE = 'SET_CURRENT_FILE'
export const STATE_YES = 'YES'
export const STATE_NO = 'NO'
export const STATE_PARTIAL = 'PARTIAL'
export const STATE_UNKNOWN = 'UNKNOWN'

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
/*
if (navigator.storage && navigator.storage.persist){
    navigator.storage.persist().then(function(persistent) {
        if (persistent) console.log("Storage will not be cleared except by explicit user action")
        else console.log("Storage may be cleared by the UA under storage pressure.")
    })
}
*/
export const selectFolder = (path, discardCache) => (dispatch, getState) => {
    dispatch({
        type: SELECT_FOLDER,
        path
    })
    getDir(serverSelector(getState()) + path, discardCache)
    .then(dir => dispatch({
        type: SET_DIRECTORY,
        path,
        dir,
        parents: getParentLinks(path, dir)
    }))
}
export const reload = () => (dispatch, getState) => {
    selectFolder(pathSelector(getState()), true)(dispatch, getState)
}

function isFolder(url) {
    return url.slice(-1) == '/'
}
export const pin = (url, pinned) => async function(dispatch, getState) {
    return _pin(url, pinned).then(() => {
        refresh(getParentDir(url))(dispatch, getState)
    })
}
async function _pin(url, pinned) {
    return (isFolder(url) ? pinFolder(url, pinned) : pinFile(url, pinned))
}
async function pinFile(url, pinned){
    await updateCache(url, {pinned})
    await updateEntryProp(url, 'pinned', pinned ? STATE_YES : STATE_NO)
}
async function pinFolder(url, pinned) {
    const dir = await getDir(url)
    return Promise.all(dir.content.map(entry => _pin(url + entry.name, pinned)))
}
async function getDir(url, discardCache = false) {
    let dir = await db.cache.get(url)
    if(!dir || discardCache) {
        let response = await fetch(url, { method: 'GET' })
        dir = await handleResponse(url, response, dir)
    }
    return dir
}
async function getFile(url) {
    let content
    try{
        const cached = await db.cache.get(url)
        content = cached.content
        if(!content) throw('no content')
    } catch(e) {
        content = await fetchBlob(url)
        await updateEntryProp(url, 'cached', STATE_YES)
        if(content) await updateCache(url, {content, cached: STATE_YES})
    }
    return content
}
async function updateEntryProp(url, prop, value) {
    const parentDir = getParentDir(url)
    if(!parentDir) return
    let dir = await getDir(parentDir)
    if(!dir) return
    const lastPartMatch = url.match(/[^\/]+\/?$/)
    const filename = lastPartMatch && lastPartMatch[0]
    return db.transaction('rw!', db.cache, async () => {
        const dir = await db.cache.get(parentDir)
        const entry = dir.content.find(candidate => candidate.name == filename)
        entry[prop] = value
        const changed = fixSummary(dir, prop)
        await db.cache.put(dir)
        return changed ? dir[prop] : null
    }).then(parentValue => {
        if(parentValue != null) return updateEntryProp(parentDir, prop, parentValue)
    })
}
const fixSummary = (cacheItem, prop) => {
    const before = cacheItem[prop]
    let summary
    for(let i=0; i<cacheItem.content.length; i++) {
        let value = cacheItem.content[i][prop]
        if(value == STATE_PARTIAL || (summary && (value != summary))) {
            summary = STATE_PARTIAL
            break
        }
        summary = value
    }
    cacheItem[prop] = summary
    return (before != summary)
}
const getParentDir = (url) => {
    const arr = url.replace(/\/$/, '').split('/')
    if(arr.length <= 3) return
    arr.pop()
    return arr.join('/') + '/'
}
async function fetchBlob(url) {
	return new Promise((resolve, reject) => {
	    var xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.responseType = 'blob'
        xhr.onload = function() {
            if (this.status == 200) {
                var blob = new Blob([this.response], { type: 'image/png' })
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
        cached: STATE_NO,
        pinned: STATE_NO,
        created: new Date().getTime()
    }
}
async function updateCache(url, obj) {
    return db.transaction('rw!', db.cache, () => {
        return db.cache.get(url)
        .then((item = getEmptyItem(url)) => {
            return db.cache.put(Object.assign(item, obj))
        })
    })
}

async function handleResponse(url, response, oldDir) {
    console.log('response', response.headers.get('Content-Type'))
    const isJson = response.headers.get('Content-Type').search('application/json') >= 0
    const content = await (isJson ? prepareJsonResponse(response) : webDavResponseToJson(response))
    // TODO need path relative to root, not to server
    const path = url.replace(/http[s]?:\/\/[^\/]*/,'').replace(/&amp;/g, '&')
    const remove = path.split('/').join(separator)
    const parentDirRemover = getParentStringRemover(remove)
    content.map(entry => {
        const oldEntry = oldDir && oldDir.content && oldDir.content.find(e => e.name == entry.name)
        return Object.assign(entry, {
            type: entry.name.match(/\/$/) ? 'Directory' : 'File',
            basename: parentDirRemover(entry.name),
            cached: oldEntry ? oldEntry.cached : STATE_UNKNOWN,
            pinned: oldEntry ? oldEntry.pinned : STATE_UNKNOWN
        })
    })
    const files = content.filter(entry => entry.type == 'File')
    await Promise.allSettled(files.map(entry => {
        const fileUrl = url + entry.name
        return Promise.all([isPinned(fileUrl), isCached(fileUrl)])
        .then(([pinned, cached]) => {
            entry.cached = cached
            entry.pinned = pinned
        })
    }))
    const dir = { content }
    fixSummary(dir, 'cached')
    fixSummary(dir, 'pinned')
    await updateCache(url, dir)
    return dir
}

async function prepareJsonResponse(response) {
    const json = await response.json()
    return json.map(name => { return {name}})
}

async function webDavResponseToJson(response) {
    const text = await response.text()
    return text
    .replace(/.*Parent Directory.*/,'')
    .match(/href="[^"]+/g)
    .map(entry => {
        const name = decodeURI(entry.slice(6)).replace(/&amp;/g, '&')
        return {
            name,
        }
    })
}

async function isPinned(url){
    const n = await db.cache.where('url').equals(url).and(entry => entry.pinned == true).count()
    return n ? STATE_YES : STATE_NO
}
async function isCached(url){
    const n = await db.cache.where('url').equals(url).and(entry => entry.cached == true).count()
    return n ? STATE_YES : STATE_NO
}


const getParentLinks = (path, dir) => {
    const relPath = path.replace(/^\//, '').replace(/\/$/, '')
    const arr = (relPath == '') ? [] : relPath.split('/')
    return arr.map((folder, idx) => { return {
        name: arr.slice(0, idx+1).join('/')+'/',
        basename: getParentStringRemover(arr.slice(0, idx).join(separator))(folder),
        cached: idx == arr.length-1 ? dir.cached : STATE_UNKNOWN,
        pinned: idx == arr.length-1 ? dir.pinned : STATE_UNKNOWN
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
    if(url == folderUrlSelector(getState())) {
        dispatch(selectFolder(pathSelector(getState())))
    }
}

export const setCurrentFile = (url) => (dispatch) => {
    getFile(url).then(blob => {
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
    getDir(parentPath)
    .then(dir => {
        const entries = dir.content.filter(entry => entry.type == 'File')
        const idx = entries.findIndex(entry => entry.name == filename)
        const newIdx = idx + d
        if(newIdx >=0 && newIdx < entries.length) dispatch(setCurrentFile(parentPath + entries[newIdx].name))
    })
}
export const next = skip(1)
export const last = skip(-1)
/*
async _readdir(path){
    const response = await fetch(graphQlRoot, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({query:`{directory(path:"/${this._path.join('/')}"){folders\nfiles}}`})
    })
    const json = await response.json()
    //
    this._files = json.data.directory.files
    this._folders = json.data.directory.folders
    this._refreshFilesMeta()
    
}
*/