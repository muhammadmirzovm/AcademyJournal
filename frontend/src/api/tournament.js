import api from './axios'

export const getTournaments      = ()           => api.get('/tournaments/')
export const createTournament    = (data)       => api.post('/tournaments/', data)
export const getTournament       = (joinCode)   => api.get(`/tournaments/${joinCode}/`)
export const joinTournament      = (joinCode)   => api.post('/tournaments/join/', { join_code: joinCode })
export const getBracket          = (joinCode)   => api.get(`/tournaments/${joinCode}/bracket/`)
export const getMatch            = (matchId)    => api.get(`/matches/${matchId}/`)
export const walkoverMatch       = (matchId, winnerId) => api.post(`/matches/${matchId}/walkover/`, winnerId ? { winner_id: winnerId } : {})
