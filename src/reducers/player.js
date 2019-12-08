import {
    SELECT_FOLDER,
    SET_DIRECTORY,
    SET_CURRENT_FILE,
    SET_PLAYING,
    SET_PLAYER_SOURCE,
    SET_TIMER,
    SET_TIME_REMAINING,
    TOGGLE_CACHED_ONLY,
    SET_INDEX_ID,
    SET_INDEX
} from '../actions/player.js'
import { createSelector } from 'reselect'

const INITIAL_STATE = {
  id: null,
  dir: [],
  parents: [],
  currentFile: null,
  isPlaying: false,
  timerStep: 60000,
  timer: 0,
  timeRemaining: 0
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
        parents: action.parents || [],
        indexId: undefined,
        index: undefined
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
    case SET_TIMER:
        return {
            ...state,
            timer: action.timeout,
            timeRemaining: action.timeout,
            timerStep: action.step
        }
    case SET_TIME_REMAINING:
        return {
            ...state,
            timeRemaining: action.timeRemaining
        }
    case SET_INDEX_ID:
        return {
            ...state,
            indexId: action.id,
            index: undefined
        }
    case SET_INDEX:
        return {
            ...state,
            index: action.index
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
export const timerSelector = state => state.player.timer
export const timeRemainingSelector = state => state.player.timeRemaining
export const timerStepSelector = state => state.player.timerStep
export const indexIdSelector = state => state.player.indexId
export const indexSelector = state => state.player.index
