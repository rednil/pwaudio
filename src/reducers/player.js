import {
    SELECT_FOLDER,
    SET_FOLDER_CONTENT,
    SET_SERVER,
    SET_CURRENT_FILE,
    SET_PLAYING,
    SET_PLAYER_SOURCE
} from '../actions/player.js'
import { createSelector } from 'reselect'

const INITIAL_STATE = {
  path: '',
  server: '',
  content: [],
  parents: [],
  currentFile: '',
  isPlaying: false
}

const player = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case SELECT_FOLDER:
      return {
        ...state,
        path: action.path,
        parents: action.parents,
        content: null
      }
    case SET_FOLDER_CONTENT:
      console.log('SET_FOLDER_CONTENT', action)
      if(state.path != action.path) return state
      return {
        ...state,
        content: action.content
      }
    case SET_SERVER:
        return {
            ...state,
            path: '',
            server: action.server,
            content: [],
            parents: []
        }
    case SET_CURRENT_FILE:
        return {
            ...state,
            currentFile: action.url,
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
    default:
      return state
  }
}

export default player
export const contentSelector = state => state.player.content
export const urlSelector = state => state.player.url
export const serverSelector = state => state.player.server
export const pathSelector = state => state.player.path
export const currentFileSelector = state => state.player.currentFile
export const isPlayingSelector = state => state.player.isPlaying
export const parentsSelector = state => state.player.parents
export const folderUrlSelector = state => state.player.server + state.player.path
export const playerSourceSelector = state => state.player.playerSource