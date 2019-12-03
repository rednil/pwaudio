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
export const STATE_ERROR = 'ERROR'
export const STATE_REQUESTED = 'REQUESTED'
export const TOGGLE_CACHED_ONLY = 'TOGGLE_CACHED_ONLY'
export const TYPE_FILE = 'File'
const TYPE_DIRECTORY = 'Directory'
const preload = 2

import Dexie from 'dexie'
import {
    currentFileSelector,
    folderIdSelector,
    cachedOnlySelector
} from '../reducers/player.js'

const separator = ' - '

const db = new Dexie('pwa-music-player')
db.version(1).stores({
    tree: '++id, name, parent, cached, type, [cached+type]',
    file: 'id, blob'
})
/*
if (navigator.storage && navigator.storage.persist){
    navigator.storage.persist().then(function(persistent) {
        if (persistent) console.log("Storage will not be cleared except by explicit user action")
        else console.log("Storage may be cleared by the UA under storage pressure.")
    })
}
*/
const cachedOnlyFilter = (cachedOnly) => {
    if (cachedOnly) return (entry) => entry.cached && (entry.cached == STATE_YES)
}

const setDirectory = (id, discardCache) => async function(dispatch, getState) {
    const dir = await getDir(id, discardCache, cachedOnlyFilter(cachedOnlySelector(getState())))
    const parents = await getParents(id, true)
    dispatch({
        type: SET_DIRECTORY,
        id,
        dir,
        parents
    })
}
export const toggleCachedOnly = () => (dispatch, getState) => {
    dispatch({
        type: TOGGLE_CACHED_ONLY
    })
    dispatch(refresh())
}
export const select = (entryOrId) => {
    return async function(dispatch) {
        const {id, entry} = await getEntryAndId(entryOrId)
        if(!entry) return window.location.hash = ''
        if(isFolder(entry)) {
            dispatch({
                type: SELECT_FOLDER,
                id
            })
            dispatch(setDirectory(id))
        }
        else dispatch(setCurrentFile(id))
    }
}
export const reload = () => (dispatch, getState) => {
    setDirectory(folderIdSelector(getState()), true)(dispatch, getState)
}
export const downloadMissing = () => async function(dispatch, getState) {
    if(getState().app.offline) return
    let missing
    const current = currentFileSelector(getState())
    if(current) {
        for(let i=1; i<preload+1; i++) {
            const next = await getNeighbour(current, i)
            if(next && next.cached != STATE_YES && next.cached != STATE_ERROR) missing = next
        }
    }
    if(!missing) {
        missing = await db.tree.where({
            cached: STATE_REQUESTED,
            type: TYPE_FILE
        }).first()
    }
    if(missing) {
        await getBlob(missing.id, dispatch, getState)
        dispatch(downloadMissing())
    }
}
const isFolder = (entry) => entry.type == TYPE_DIRECTORY
const isFile = (entry) => entry.type == TYPE_FILE
export const pin = (entryOrId) => async function(dispatch) {
    const {id, entry} = await getEntryAndId(entryOrId)
    const value = (entry.pinned == STATE_YES) ? STATE_NO : STATE_YES
    let changed = false
    if(isFile(entry)) {
        await pinFile(entry, value)
    }
    else {
        if(value == STATE_YES) {
            const n = await countChildren(id)
        }
        await pinFolder(entry, value)
    }
    await fixSummary(entry.parent)
    dispatch(refresh())
    dispatch(downloadMissing())
}
async function pinFile(entry, value){
    entry.pinned = value
    if(value == STATE_YES){
        if(entry.cached != STATE_YES) entry.cached = STATE_REQUESTED
    }
    else if(entry.cached == STATE_REQUESTED) entry.cached = STATE_NO
    await db.tree.put(entry)
}
async function pinFolder(entry, value) {
    const children = await getDir(entry.id)
    await Promise.all(children.map(child => {
        return (isFolder(child)) ? pinFolder(child, value) : pinFile(child, value)
    }))
    const changed = summary.cached(entry, children)
    entry.pinned = value
    db.tree.put(entry)
    return changed
}
async function countChildren(id) {
    const dir = await getDir(id)
    const files = dir.filter(isFile)
    const folders = dir.filter(isFolder)
    let n = files.length
    for(let i=0; i<folders.length; i++) {
        n = n + await countChildren(folders[i].id)
    }
    return n
}
async function getDir(id, discardCache = false, filter) {
    let dir = await db.tree.where({parent: id}).toArray()
    if(!dir || !dir.length || discardCache) {
        dir = await fetchDir(id, dir)
    }
    if(filter) dir=dir.filter(filter)
    return dir
}
async function fetchDir(id, oldDir) {
    const parents = await getParents(id, true)
    const url = await id2url(id)
    let response = await fetch(url, { method: 'GET' })
    const isJson = true //response.headers.get('Content-Type').search('application/json') >= 0
    const content = await (isJson ? prepareJsonResponse(response) : webDavResponseToJson(response))
    // TODO need path relative to root, not to server
    //const path = url.replace(/http[s]?:\/\/[^\/]*\/[^\/]*/,'').replace(/&amp;/g, '&')
    const remove = parents.map(parent => parent.name.replace('/', '')).join(separator)
    const parentDirRemover = getParentStringRemover(remove)
    const newEntries = content
    .filter(entry => !oldDir.find(oldEntry => oldEntry.name == entry.name))
    .map(entry => {
        return {
            parent: id,
            name: entry.name,
            type: entry.name.match(/\/$/) ? TYPE_DIRECTORY : TYPE_FILE,
            basename: parentDirRemover(entry.name),
        }
    })
    const obsoleteOldEntries = []
    const validOldEntries = []
    oldDir.forEach(oldEntry => {
        if (content.find(entry => oldEntry.name == entry.name)) validOldEntries.push(oldEntry)
        else obsoleteOldEntries.push(oldEntry)
    })
    await db.transaction('rw!', db.tree, () => Promise.all(newEntries.map(entry => db.tree.put(entry))))
    const dir = newEntries.concat(validOldEntries)
    return dir
}
async function getParents(id, includeMyself, includeRoot) {
    const parents = []
    while(id) {
        const entry = await db.tree.get(id)
        id = entry.parent
        parents.unshift(entry)
    }
    return parents.slice(includeRoot ? 0 : 1, includeMyself ? parents.length : -1)
}
async function id2url (id) {
    let url = ''
    while(id) {
        const entry = await db.tree.get(id)
        id = entry.parent
        url = (id ? encodeURIComponent(entry.name) : entry.name) + url
    }
    return url
}
async function getBlob(id, dispatch, getState) {
    const cached = await db.file.get(id)
    let blob = cached && cached.blob
    if(!blob) {
        try {
            const url = await id2url(id)
            blob = await fetchBlob(url)
            await db.file.put({id, blob})
            await updateEntry(id, {cached: STATE_YES, error: undefined}, dispatch)
        }
        catch(error) {
            console.error('getBlob error', error, '=> removing cache entry')
            const msg = error + ' ' + (getState().app.offline ? 'offline' : 'online')
            await updateEntry(id, {cached: STATE_ERROR, error: msg })
        }
    }
    return blob
}
async function updateEntry(id, props, dispatch) {
    return db.transaction('rw!', db.tree, async () => {
        const entry = await db.tree.get(id)
        Object.assign(entry, props)
        await db.tree.put(entry)
        await fixSummary(entry.parent)
        if(dispatch) dispatch(refresh())
    })
}

const stateSummary = (prop) => (entry, children) => {
    const before = entry[prop] || STATE_NO
    let summary
    for(let i=0; i<children.length; i++) {
        let value = children[i][prop] || STATE_NO
        if(value == STATE_REQUESTED) {
            summary = STATE_REQUESTED
            break
        }
        if(value == STATE_PARTIAL || (summary && (value != summary))) {
            summary = STATE_PARTIAL
            break
        }
        summary = value
    }
    entry[prop] = summary
    return (before != summary)
}
const summary = {
    cached: stateSummary('cached'),
    pinned: stateSummary('pinned')
}
async function getEntryAndId (entryOrId) {
    const id = Number(entryOrId.id || entryOrId)
    return {
        id,
        entry: entryOrId.id ? entryOrId : await db.tree.get(id)
    }
}
const fixSummary = async (entryOrId) => {
    // be null tolerant to prevent checks everywhere else
    if(!entryOrId) return
    const {entry, id} = await getEntryAndId(entryOrId)
    const children = await getDir(id)
    const cachedChanged = summary.cached(entry, children)
    const pinnedChanged = summary.pinned(entry, children)
    await db.tree.put(entry)
    if(cachedChanged || pinnedChanged){
        await fixSummary(entry.parent)
    }
}
async function fetchBlob(url) {
	return new Promise((resolve, reject) => {
	    var xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.responseType = 'blob'
        xhr.onload = function() {
            if (this.status == 200) {
                var blob = new Blob([this.response])
                resolve(blob)
            }
            else {
                reject(this.status)
                console.error('XMLHttpRequest Status', this.status)
            }
        }
        xhr.onerror = function(error) {
            reject(error)
            console.error('XMLHttpRequest Error', error) 
        }
        xhr.send()
    })
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
        const folderId = folderIdSelector(getState())
        const parentsOfFilePlaying = await getParents(currentFileSelector(getState()))
        if(!parentsOfFilePlaying.find(entry => entry.id == folderId)){
            const entryOrId = await getLastPlayedOrFirst(folderId)
            return dispatch(setCurrentFile(entryOrId))
        }
    }
    dispatch({
        type: SET_PLAYING,
        bool
    })
}
async function getLastPlayedOrFirst(entryOrId) {
    const {id, entry} = await getEntryAndId(entryOrId)
    if(entry.lastPlayed) {
        const lastPlayed = await db.tree.get(entry.lastPlayed)
        if(isFile(lastPlayed)) return lastPlayed
        else return await getLastPlayedOrFirst(lastPlayed)
    }
    else {
        const children = await getDir(id)
        for(let i=0; i<children.length; i++) {
            const child = children[i]
            if(isFile(child)) return child
            else return await getLastPlayedOrFirst(child)
        }
    }
}
export const setServer = (name) => async function (dispatch) {
    const root = await db.tree.where({name}).first()
    const id = root ? root.id : await db.tree.put({
        name, 
        parent:0,
        type: TYPE_DIRECTORY
    })
    dispatch(select(id))
}
const refresh = () => async function (dispatch, getState) {
    const id = folderIdSelector(getState())
    if(id) setDirectory(id)(dispatch, getState)
}
export const setCurrentFile = (entryOrId) => async function(dispatch, getState){
    const {id, entry} = await getEntryAndId(entryOrId)
    dispatch({
        type: SET_CURRENT_FILE,
        id
    })
    await rememberLastPlayed(entry)
    dispatch(refresh())
    const blob = await getBlob(id, dispatch, getState)
    if(blob) {
        dispatch({
            type: SET_PLAYER_SOURCE,
            url: window.URL.createObjectURL(blob)
        })
    }
    dispatch(downloadMissing())
}
async function rememberLastPlayed (entryOrId) {
    const {id, entry} = await getEntryAndId(entryOrId)
    if(!entry.parent) return
    const parentEntry = await db.tree.get(entry.parent)
    if(parentEntry.lastPlayed != id) {
        parentEntry.lastPlayed = id
        db.tree.put(parentEntry)
    }
    await rememberLastPlayed(parentEntry)
}
const getNeighbour = async function (entryOrId, d) {
    const {id, entry} = await getEntryAndId(entryOrId)
    const dir = await getDir(entry.parent)
    const files = dir.filter(isFile)
    const idx = files.findIndex(file => file.id == entry.id)
    if(idx != null) {
        const newIdx = idx + d
        if (newIdx >=0 && newIdx < files.length) return files[newIdx]
    }
}
const skip = (d) => () => async (dispatch, getState) => {
    const neighbour = await getNeighbour(currentFileSelector(getState()), d)
    if(neighbour) dispatch(setCurrentFile(neighbour))
}
export const next = skip(1)
export const last = skip(-1)
