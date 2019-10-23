import {
    SELECT_FOLDER,
    SET_FOLDER_CONTENT,
    SET_SERVER,
    SET_CURRENT_FILE,
    SET_PLAYING
} from '../actions/player.js'
import { createSelector } from 'reselect'

const INITIAL_STATE = {
  path: '',
  response: [],
  server: '',
  currentFile: '',
  isPlaying: false
}

const separator = ' - '

const player = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case SELECT_FOLDER:
      return {
        ...state,
        path: action.path,
        response: []
      }
    case SET_FOLDER_CONTENT:
      if(state.path != action.path) return state
      return {
        ...state,
        response: action.response
      }
    case SET_SERVER:
        return {
            ...state,
            path: '',
            server: action.server,
            response: []
        }
    case SET_CURRENT_FILE:
        return {
            ...state,
            currentFile: action.filename,
            isPlaying: true
        }
    case SET_PLAYING:
        return {
            ...state,
            isPlaying: action.bool
        }
    default:
      return state
  }
}

export default player
export const responseSelector = state => state.player.response
export const urlSelector = state => state.player.url
export const serverSelector = state => state.player.server
export const pathSelector = state => state.player.path
export const currentFileSelector = state => state.player.currentFile
export const isPlayingSelector = state => state.player.isPlaying

// return all parents (relative to root dir) 
export const parentsSelector = createSelector(
    pathSelector,
    path => {
        const relPath = path.replace(/^\//, '').replace(/\/$/, '')
        const arr = (relPath == '') ? [] : relPath.split('/')
        return arr.map((folder, idx) => { return {
            filename: arr.slice(0, idx+1).join('/')+'/',
            basename: getParentStringRemover(arr.slice(0, idx).join(separator))(folder)
        }})
    }
)
export const contentSelector = createSelector(
    responseSelector,
    parentsSelector,
    (response, parents) => {
        const remove = parents.map(folder => folder.basename).join(separator)
        const parentDirRemover = getParentStringRemover(remove)
        return response.map(entry => { return {
            filename: entry,
            basename: parentDirRemover(entry),
            type: entry.match(/\/$/) ? 'folder' : 'file'
        }})
    }
)
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