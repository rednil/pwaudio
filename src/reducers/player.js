import {
    SELECT_FOLDER,
    SET_DIRECTORY,
    SET_CURRENT_FILE,
    SET_PLAYING,
    SET_PLAYER_SOURCE,
    TOGGLE_CACHED_ONLY
} from '../actions/player.js'
import { createSelector } from 'reselect'

const INITIAL_STATE = {
  id: null,
  dir: [],
  parents: [],
  currentFile: null,
  isPlaying: false
}

const player = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case SELECT_FOLDER:
      return {
        ...state,
        id: action.id,
        parents: [],
        dir: []
      }
    case SET_DIRECTORY:
      if(state.id != action.id) return state
      return {
        ...state,
        dir: action.dir || [],
        parents: action.parents || []
      }
    case SET_CURRENT_FILE:
        return {
            ...state,
            currentFile: action.id,
            //isPlaying: true
        }
    case SET_PLAYER_SOURCE:
        return {
            ...state,
            playerSource: action.url,
            isPlaying: true
        }
    case SET_PLAYING:
        return {
            ...state,
            isPlaying: action.bool
        }
    case TOGGLE_CACHED_ONLY:
        return {
            ...state,
            cachedOnly: !state.cachedOnly
        }
    default:
      return state
  }
}

export default player
export const lastPlayedSelector = state => state.player.parents && state.player.parents.length && state.player.parents[state.player.parents.length-1].lastPlayed
export const contentSelector = state => state.player.dir
export const currentFileSelector = state => state.player.currentFile
export const isPlayingSelector = state => state.player.isPlaying
export const parentsSelector = state => state.player.parents
export const folderIdSelector = state => state.player.id
export const playerSourceSelector = state => state.player.playerSource
export const cachedOnlySelector = state => state.player.cachedOnly