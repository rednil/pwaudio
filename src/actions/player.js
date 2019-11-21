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
const TYPE_FILE = 'File'
const TYPE_DIRECTORY = 'Directory'
const preload = 2

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
    cache: `url, created, pinned, cached, type, [pinned+cached+type]`
})
/*
if (navigator.storage && navigator.storage.persist){
    navigator.storage.persist().then(function(persistent) {
        if (persistent) console.log("Storage will not be cleared except by explicit user action")
        else console.log("Storage may be cleared by the UA under storage pressure.")
    })
}
*/
export const selectFolder = (path) => (dispatch, getState) => {
    dispatch({
        type: SELECT_FOLDER,
        path
    })
    dispatch(setDirectory(path))
}
const setDirectory = (path, discardCache) => (dispatch, getState) => {
    getDir(serverSelector(getState()) + path, discardCache)
    .then(dir => dispatch({
        type: SET_DIRECTORY,
        path,
        dir,
        parents: getParentLinks(path, dir)
    }))
}
export const reload = () => (dispatch, getState) => {
    setDirectory(pathSelector(getState()), true)(dispatch, getState)
}
export const downloadMissing = () => async function(dispatch, getState) {
    if(getState().app.offline) return
    let missing
    let cacheEntry
    const current = currentFileSelector(getState())
    if(current) {
        for(let i=1; i<preload+1; i++) {
            const next = await getNeighbour(current, i)
            if(next && !next.error) {
                cacheEntry = await db.cache.get(next.url)
                if(!cacheEntry || cacheEntry.cached != STATE_YES) {
                    missing = next.url
                    break
                }
            }
        }
    }
    if(!missing) {
        cacheEntry = await db.cache.where({
            pinned: STATE_YES,
            cached: STATE_NO,
            type: TYPE_FILE
        }).first()
        missing = cacheEntry && cacheEntry.url
    }
    if(missing) {
        await getFile(missing)
        dispatch(refresh(missing))
        dispatch(downloadMissing())
    }
}

const isFolder = (url) => {
    return url && url.slice(-1) == '/'
}
const isFile = (url) => {
    return url && url.slice(-1) != '/'
}
export const pin = (url, pinned) => async function(dispatch, getState) {
    if(pinned === true) pinned = STATE_YES
    if(pinned === false) pinned = STATE_NO
    return _pin(url, pinned).then(() => {
        refresh(getParentUrl(url))(dispatch, getState)
        dispatch(downloadMissing())
    })
}
async function _pin(url, pinned) {
    return (isFolder(url) ? pinFolder(url, pinned) : pinFile(url, pinned))
}
async function pinFile(url, pinned){
    await updateCache(url, { pinned, type: TYPE_FILE })
    await updateEntryProp(url, 'pinned', pinned).then(() => {
    })
}
async function pinFolder(url, pinned) {
    const dir = await getDir(url)
    return Promise.all(dir.content.map(entry => _pin(url + entry.name, pinned)))
}
const encodeURI = (uri) => {
    const segments = uri.split('/')
    return segments.slice(0,3).concat(segments.slice(3).map(encodeURIComponent)).join('/')
}
async function getDir(url, discardCache = false) {
    let dir = await db.cache.get(url)
    if(!dir || discardCache) {
        let response = await fetch(encodeURI(url), { method: 'GET' })
        dir = await handleResponse(url, response, dir)
    }
    return dir
}
async function getFile(url) {
    const cached = await db.cache.get(url)
    let content = cached && cached.content
    if(!content) {
        try {
            content = await fetchBlob(url)
            await updateEntryProp(url, 'cached', STATE_YES)
        }
        catch(error) {
            console.error('getFile error', error, '=> removing cache entry')
            if(error.status == 404 && cached) await db.cache.delete(url)
            await updateEntryProp(url, 'error', 404, true)
        }
    }
    if(content) await updateCache(url, {
        content,
        cached: STATE_YES,
        type: TYPE_FILE
    })
    return content
}
const getBasePath = (url) => {
    const lastPartMatch = url.match(/[^\/]+\/?$/)
    return lastPartMatch && lastPartMatch[0]
}
async function updateEntryProp(url, prop, value, dontPropagate) {
    const parentDir = getParentUrl(url)
    if(!parentDir) return
    const filename = getBasePath(url)
    return db.transaction('rw!', db.cache, async () => {
        const dir = await getDir(parentDir)
        const entry = dir.content.find(candidate => candidate.name == filename)
        entry[prop] = value
        const changed = fixSummary(dir, prop)
        await db.cache.put(dir)
        return (!dontPropagate && changed) ? dir[prop] : null
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
const getParentUrl = (url) => {
    const arr = url.replace(/\/$/, '').split('/')
    if(arr.length <= 4) return
    arr.pop()
    return arr.join('/') + '/'
}
async function fetchBlob(url) {
	return new Promise((resolve, reject) => {
	    var xhr = new XMLHttpRequest()
        xhr.open('GET', encodeURI(url), true)
        xhr.responseType = 'blob'
        xhr.onload = function() {
            if (this.status == 200) {
                var blob = new Blob([this.response])
                resolve(blob)
            }
            else {
                reject({request: this})
                console.error('XMLHttpRequest Status', this.status)
            }
        }
        xhr.onerror = function(error) {
            reject({request: this, error})
            console.error('XMLHttpRequest Error', this.status, error)
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
    const isJson = true //response.headers.get('Content-Type').search('application/json') >= 0
    const content = await (isJson ? prepareJsonResponse(response) : webDavResponseToJson(response))
    // TODO need path relative to root, not to server
    const path = url.replace(/http[s]?:\/\/[^\/]*\/[^\/]*/,'').replace(/&amp;/g, '&')
    const remove = path.split('/').join(separator)
    console.log('remove', path, remove)
    const parentDirRemover = getParentStringRemover(remove)
    content.map(entry => {
        const oldEntry = oldDir && oldDir.content && oldDir.content.find(e => e.name == entry.name)
        return Object.assign(entry, {
            type: entry.name.match(/\/$/) ? TYPE_DIRECTORY : TYPE_FILE,
            basename: parentDirRemover(entry.name),
            cached: oldEntry ? oldEntry.cached : STATE_UNKNOWN,
            pinned: oldEntry ? oldEntry.pinned : STATE_UNKNOWN
        })
    })
    const files = content.filter(entry => entry.type == TYPE_FILE)
    await Promise.allSettled(files.map(entry => {
        const fileUrl = url + entry.name
        return Promise.all([isPinned(fileUrl), isCached(fileUrl)])
        .then(([pinned, cached]) => {
            entry.cached = cached
            entry.pinned = pinned
        })
    }))
    const dir = { 
        content,
        type: TYPE_DIRECTORY
    }
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
    const n = await db.cache.where({
        url,
        pinned: STATE_YES
    }).count()
    return n ? STATE_YES : STATE_NO
}
async function isCached(url){
    const n = await db.cache.where({
        url,
        cached: STATE_YES
    }).count()
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

export const play = (bool) => async function (dispatch, getState) {
    if(bool) {
        const folderUrl = folderUrlSelector(getState())
        const currentFile = currentFileSelector(getState())
        if(!(currentFile && (currentFile.search(folderUrl) == 0))) {
            const file = await getLastPlayedOrFirst(folderUrl)
            return dispatch(setCurrentFile(file))
        }
    }
    dispatch({
        type: SET_PLAYING,
        bool
    })
}

async function getLastPlayedOrFirst(url) {
    const dir = await getDir(url)
    let file = dir.lastPlayed
    let target
    if(isFile(file)) target = url + file
    else if(isFolder(file)) target = await getLastPlayedOrFirst(url + file)
    if(target) return target
    for(let i=0; i<dir.content.length; i++) {
        file = dir.content[i].name
        if(isFile(file)) target = url + file 
        else target = await getLastPlayedOrFirst(url + file)
        if(target) return target
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
    if(!isFolder(url)) url = getParentUrl(url)
    if(url.search(folderUrlSelector(getState())) == 0) {
        setDirectory(pathSelector(getState()))(dispatch, getState)
    }
}

export const setCurrentFile = (url) => (dispatch) => {
    dispatch({
        type: SET_CURRENT_FILE,
        url
    })
    rememberLastPlayed(url).then(() => {
        dispatch(refresh(url))
    })
    getFile(url).then(blob => {
        dispatch(refresh(url))
        dispatch({
            type: SET_PLAYER_SOURCE,
            url: window.URL.createObjectURL(blob)
        })
        dispatch(downloadMissing())
    })
}
async function rememberLastPlayed (url) {
    const parentUrl = getParentUrl(url)
    if(!parentUrl) return
    const lastPlayed = getBasePath(url)
    const parentDir = await db.cache.get(parentUrl)
    if(parentDir.lastPlayed != lastPlayed) {
        await updateCache(parentUrl, {lastPlayed})
    }
    await rememberLastPlayed(parentUrl)
}
const getNeighbour = async function (url, d) {
    const parents = url.split('/')
    const filename = parents.pop()
    const parentPath = parents.join('/') + '/'
    return getDir(parentPath)
    .then(dir => {
        const entries = dir.content.filter(entry => entry.type == TYPE_FILE)
        const idx = entries.findIndex(entry => entry.name == filename)
        const newIdx = idx + d
        return (newIdx >=0 && newIdx < entries.length) ? ({
            ...entries[newIdx],
            url: parentPath + entries[newIdx].name
        }) : null
    })
}

const skip = (d) => () => (dispatch, getState) => {
    getNeighbour(currentFileSelector(getState()), d).then(neighbour => {
        if(neighbour) dispatch(setCurrentFile(neighbour.url))
    })
}
export const next = skip(1)
export const last = skip(-1)
