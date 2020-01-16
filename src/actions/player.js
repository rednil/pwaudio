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
export const SET_TIMER = 'SET_TIMER'
export const SET_TIME_REMAINING = 'SET_TIME_REMAINING'
export const SET_INDEX_ID = 'SET_INDEX_ID'
export const SET_INDEX = 'SET_INDEX'

export const TYPE_FOLDER = 'Directory'
const preload = 2
let blockDownloadMissing = false

import Dexie from 'dexie'
import {
    currentFileSelector,
    folderIdSelector,
    cachedOnlySelector,
    timerStepSelector,
    timerSelector,
    timeRemainingSelector,
    isPlayingSelector,
    indexIdSelector
} from '../reducers/player.js'

const separator = ' - '

const db = new Dexie('pwa-music-player')
db.version(1).stores({
    tree: '++id, name, parent, cached, type, [cached+type]',
    file: 'id, blob'
})
let timer

if (navigator.storage && navigator.storage.persist){
    navigator.storage.persist().then(function(persistent) {
        if (persistent) console.log("Storage will not be cleared except by explicit user action")
        else console.log("Storage may be cleared by the UA under storage pressure.")
    })
}

const cachedOnlyFilter = entry => entry.cached && (entry.cached == STATE_YES) || (entry.cached == STATE_PARTIAL)

const setDirectory = (id, discardCache) => async function(dispatch, getState) {
    const dir = await getDir(id, discardCache, getState)
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
export const setTimer = (timeout, step) => (dispatch, getState) => {
    if(step == null) step = timerStepSelector(getState())
    if(timeout == null) timeout = timerSelector(getState())
    dispatch({
        type: SET_TIMER,
        timeout,
        step
    })
    if(timer) clearTimeout(timer)
    if(timeout && isPlayingSelector(getState())) {
        timer = setInterval(() => {
            const isPlaying = isPlayingSelector(getState())
            const timeRemaining = timeRemainingSelector(getState())
            if(!isPlaying || timeRemaining<=1) {
                window.clearInterval(timer)
                dispatch(play(false))
                dispatch(setTimer())
            }
            else{
                dispatch({
                    type: SET_TIME_REMAINING,
                    timeRemaining: timeRemaining-1
                })
            }
        }, step)
    }
}
export const toggleIndex = entry => async (dispatch, getState) => {
    const oldId = indexIdSelector(getState())
    const newId = oldId == entry.id ? null : entry.id 
    dispatch({
        type: SET_INDEX_ID,
        id: newId
    })
    if(!newId) return
    const url = await id2url(entry.id)
    const response = await fetch(url + entry.index)
    const index = await response.text()
    if(indexIdSelector(getState()) == newId) {
        dispatch({
            type: SET_INDEX,
            index
        })
    }
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
let concurrentRequests = 0
const maxConcurrentRequests = 4
export const downloadMissing = () => async function(dispatch, getState) {
    if(blockDownloadMissing || getState().app.offline || (concurrentRequests >= maxConcurrentRequests)) return
    // before first await!
    concurrentRequests +=1
    let missing
    const current = currentFileSelector(getState())
    if(current) {
        for(let i=1; i<preload+1; i++) {
            const next = await getNeighbour(current, i, getState)
            if(
                next &&
                next.cached != STATE_YES &&
                next.cached != STATE_ERROR &&
                next.cached != STATE_PARTIAL
            ) missing = next
        }
    }
    if(!missing) {
        missing = await db.tree.where({
            cached: STATE_REQUESTED,
            type: TYPE_FILE
        }).first()
    }
    if(!missing) {
        const time = new Date().getTime()
        const inProgress = await db.tree.where({
            cached: STATE_PARTIAL,
            type: TYPE_FILE
        }).toArray()
        missing = inProgress.find(entry => ((time-(entry.cacheTime||0)) > 240000))
    }
    if(missing) {
        await getBlob(missing, dispatch, getState)
        concurrentRequests -= 1
        dispatch(downloadMissing())
    }
    else concurrentRequests -= 1
    
}
const isFolder = (entry) => entry.type == TYPE_FOLDER
const isFile = (entry) => entry.type == TYPE_FILE
export const pin = (entryOrId) => async function(dispatch) {
    const {id, entry} = await getEntryAndId(entryOrId)
    const value = (entry.pinned == STATE_YES) ? STATE_NO : STATE_YES
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
async function getDir(id, discardCache = false, getState) {
    let dir = await db.tree.where({parent: id}).toArray()
    if(!dir || !dir.length || discardCache) {
        dir = await fetchDir(id, dir)
    }
    if(getState) {
        if(getState().app.offline || cachedOnlySelector(getState()))
        dir = dir.filter(cachedOnlyFilter)
    }
    return dir
}

const getExtension = str => ((str.match(/\.([^\.]+$)/) || [])[1] || '').toLowerCase()
const isIndex = entry => entry.name == 'index.html'
const audioFileExtensions = ['ogg', 'mp3']
const isAudioFileOrFolder = entry => ((entry.name.slice(-1) == '/') || audioFileExtensions.includes(getExtension(entry.name)))

// Reproduce:
// Log in using chrome, than change password, restart server, open directory that is NOT cached yet =>
// 401 response without basic auth popup. Firefox opens auth popup as expected.
const serviceWorkerAuthChangedHack = () => {
    navigator.serviceWorker.getRegistrations().then(
        function(registrations) {
            for(let registration of registrations) {
                console.log('unregister', registration)
                registration.unregister();
            }
            location.reload()
        }
    )
}

async function fetchDir(id, oldDir) {
    const parents = await getParents(id, true)
    const parent = parents[parents.length-1]
    const url = await id2url(id)
    let response = await fetch(url, { method: 'GET' , credentials: 'same-origin'})
    if(response.status != 200) {
        console.error('fetchDir error', response.status, response.error)
        if(response.status == 401) serviceWorkerAuthChangedHack()
        return []
    }
    const isJson = true //response.headers.get('Content-Type').search('application/json') >= 0
    const content = await (isJson ? prepareJsonResponse(response) : webDavResponseToJson(response))
    const index = content.find(isIndex)
    // TODO need path relative to root, not to server
    //const path = url.replace(/http[s]?:\/\/[^\/]*\/[^\/]*/,'').replace(/&amp;/g, '&')
    const remove = parents.map(parent => parent.name.replace('/', '')).join(separator)
    const parentDirRemover = getParentStringRemover(remove)
    const newEntries = content
    .filter(isAudioFileOrFolder)
    .filter(entry => !oldDir.find(oldEntry => oldEntry.name == entry.name))
    .map(entry => {
        return {
            parent: id,
            name: entry.name,
            type: entry.name.match(/\/$/) ? TYPE_FOLDER : TYPE_FILE,
            basename: parentDirRemover(entry.name),
        }
    })
    const obsoleteOldEntries = []
    const validOldEntries = []
    oldDir.forEach(oldEntry => {
        if (content.find(entry => oldEntry.name == entry.name)) validOldEntries.push(oldEntry)
        else obsoleteOldEntries.push(oldEntry)
    })
    try{
        await db.transaction('rw!', db.tree, () => Promise.all(newEntries.map(entry => db.tree.put(entry))))
        if(index) await updateEntry(id, {index: index.name})
    }
    catch(e) {
        console.log('db error', e)
    }
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
async function getBlob(entry, dispatch, getState) {
    const id = entry.id
    const cached = await db.file.get(id)
    let blob = cached && cached.blob
    let isCached = true
    if(!blob) {
        try {
            await updateEntry(id, {cached: STATE_PARTIAL, cacheTime: new Date().getTime()})
            dispatch(refresh())
            dispatch(downloadMissing())
            const url = await id2url(id)
            blob = await fetchBlob(url)
            await putBlob(id, blob) 
        }
        catch(error) {
            isCached = false
            console.error('getBlob error', error)
            const msg = error + ' ' + (getState().app.offline ? 'offline' : 'online')
            await updateEntry(id, {cached: STATE_ERROR, error: msg })
            dispatch(refresh())
        }
    }
    if(isCached && (entry.cached!=STATE_YES)){
        await updateEntry(id, {
            cached: STATE_YES,
            error: undefined,
            size: blob.size
        })
        dispatch(refresh())
    }
    return blob
}

const toMb = num => `${Math.round(num/1000000)} MB`

let freeingSpaceDoesntHelp = false
const putBlob = async (id, blob) => {
    const maxDbSize = 2000 * 1000000
    const fileEntries = await db.tree.where({type: TYPE_FILE, cached: STATE_YES}).toArray()
    let dbSize = fileEntries.reduce((sum, entry) => sum + (entry.size || 0), 0)
    while ((dbSize + blob.size) > maxDbSize) {
        dbSize -= await freeSpace(fileEntries)
    }
    let spaceFreed = 0
    let sumSpaceFreed = 0
    do {
        try {
            spaceFreed = 0
            await db.file.put({id, blob})
            // successfully dumped a file, clear all damage prevention flags
            blockDownloadMissing = false
            freeingSpaceDoesntHelp = false
        }
        catch(e){
            // never managed to produce a distinct "out of space" error in Chrome,
            // so catch ALL exceptions, try to free space and trigger some damage prevention
            // if it doesn't help (dont try again in this browser session)
            if(sumSpaceFreed >= blob.size) freeingSpaceDoesntHelp = true
            if(freeingSpaceDoesntHelp) {
                blockDownloadMissing = true
                throw(e)
            }
            else {
                spaceFreed = await freeSpace(fileEntries)
                sumSpaceFreed += spaceFreed
            }
        }
    } while (spaceFreed)
}

const pinnedElevator = (entry => entry.cacheTime - (entry.pinned == STATE_YES ? 0 : 1000000000000))
let pinDeletePermission
const freeSpace = async (entries) => {
    // sort descending cacheTime, pinned first
    entries = entries.sort((a,b) => pinnedElevator(b) - pinnedElevator(a))
    const entry = entries.pop()
    if(getDeletePermission(entry)) {
        await remove(entry)
        return entry.size
    }
    blockDownloadMissing = true
    throw(`unable to free space (PinDeletePermission: ${pinDeletePermission})`)
}

const remove = async (entryOrId) => {
    const id = entryOrId.id || id
    await db.file.delete(id)
    await updateEntry(id, {
        cacheTime: undefined,
        size: undefined,
        cached: STATE_NO,
        pinned:STATE_NO
    })
}

const getDeletePermission = (entry) => {
    if(!entry) return false
    if(entry.pinned != STATE_YES || pinDeletePermission) return true
    if(pinDeletePermission == null) {
        return pinDeletePermission = confirm('automatically delete pinned files?')
    }
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
            // we are in a different folder than the file last played, look for a file to play
            const entryOrId = await getLastPlayedOrFirst(folderId, getState)
            return dispatch(setCurrentFile(entryOrId))
        }
    }
    dispatch({
        type: SET_PLAYING,
        bool
    })
    if(bool) dispatch(setTimer())
}
async function getLastPlayedOrFirst(entryOrId, getState) {
    const {id, entry} = await getEntryAndId(entryOrId)
    if(entry.lastPlayed) {
        const lastPlayed = await db.tree.get(entry.lastPlayed)
        if(isFile(lastPlayed)) return lastPlayed
        else return await getLastPlayedOrFirst(lastPlayed, getState)
    }
    else {
        const children = await getDir(id, false, getState)
        for(let i=0; i<children.length; i++) {
            const child = children[i]
            if(isFile(child)) return child
            else return await getLastPlayedOrFirst(child, getState)
        }
    }
}
export const setServer = (name) => async function (dispatch) {
    const root = await db.tree.where({name}).first()
    const id = root ? root.id : await db.tree.put({
        name, 
        parent:0,
        type: TYPE_FOLDER
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
    const blob = await getBlob(entry, dispatch, getState)
    if(blob) {
        dispatch({
            type: SET_PLAYER_SOURCE,
            url: window.URL.createObjectURL(blob)
        })
        dispatch(setTimer())
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
const getNeighbour = async function (entryOrId, d, getState) {
    const {id, entry} = await getEntryAndId(entryOrId)
    const dir = await getDir(entry.parent, false, getState)
    const files = dir.filter(isFile)
    const idx = files.findIndex(file => file.id == entry.id)
    if(idx != null) {
        const newIdx = idx + d
        if (newIdx >=0 && newIdx < files.length) return files[newIdx]
    }
}
const skip = (d) => () => async (dispatch, getState) => {
    const neighbour = await getNeighbour(currentFileSelector(getState()), d, getState)
    if(neighbour) dispatch(setCurrentFile(neighbour))
}
export const next = skip(1)
export const last = skip(-1)
