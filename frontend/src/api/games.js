import api from './axios'

export const getLessonGame  = (gid, lid)       => api.get(`/groups/${gid}/lessons/${lid}/game/`)
export const startGame      = (gid, lid)       => api.post(`/groups/${gid}/lessons/${lid}/game/start/`)
export const cancelGame     = (gid, lid)       => api.post(`/groups/${gid}/lessons/${lid}/game/cancel/`)
export const closeGame      = (gid, lid, data) => api.post(`/groups/${gid}/lessons/${lid}/game/close/`, data)
export const getGameHistory = (gid)            => api.get(`/groups/${gid}/game-history/`)
