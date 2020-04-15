import {
    SELECT_FOLDER,
    SET_DIRECTORY,
    SET_CURRENT_FILE,
    SET_PLAYING,
    SET_PLAYER_SOURCE,
    SET_TIMER,
    SET_CACHE_SIZE,
    SET_MAX_CACHE_SIZE,
    SET_TIME_REMAINING,
    TOGGLE_CACHED_ONLY,
    SET_INDEX_ID,
    SET_INDEX,
    SET_PREFETCH
} from '../actions/player.js'

const INITIAL_STATE = {
  id: null,
  dir: [],
  parents: [],
  prefetch: Number(localStorage.getItem('prefetch') || 3),
  currentFile: null,
  isPlaying: false,
  timerStep: 60000,
  timer: Number(localStorage.getItem('timer') || 0),
  timeRemaining: Number(localStorage.getItem('timer') || 0),
  cacheSize: 0,
  maxCacheSize: Number(localStorage.getItem('maxCacheSize') || (500 * 1000000))
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
    case SET_CACHE_SIZE:
      return {
        ...state,
        cacheSize: action.size
      }
    case SET_MAX_CACHE_SIZE:
      localStorage.setItem('maxCacheSize', action.size)
      return {
        ...state,
        maxCacheSize: action.size
      }
    case TOGGLE_CACHED_ONLY:
      return {
        ...state,
        cachedOnly: !state.cachedOnly
      }
    case SET_TIMER:
      localStorage.setItem('timer', action.timeout)
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
    case SET_PREFETCH:
      const prefetch = Number(action.prefetch)
      localStorage.setItem('prefetch', prefetch)
      return {
        ...state,
        prefetch
      }
    default:
      return state
  }
}

export default player
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
export const cacheSizeSelector = state => state.player.cacheSize
export const maxCacheSizeSelector = state => state.player.maxCacheSize
