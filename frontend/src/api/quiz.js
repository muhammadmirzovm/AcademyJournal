import api from './axios'

export const getTopics          = (params)            => api.get('/quiz/topics/', { params })
export const getQuestionBanks   = ()                  => api.get('/quiz/question-banks/')
export const createTopic        = (data)              => api.post('/quiz/topics/', data)
export const updateTopic        = (id, data)          => api.patch(`/quiz/topics/${id}/`, data)
export const deleteTopic        = (id)                => api.delete(`/quiz/topics/${id}/`)

export const getQuestions       = (params)            => api.get('/quiz/questions/', { params })
export const createQuestion     = (data)              => api.post('/quiz/questions/', data)
export const updateQuestion     = (id, data)          => api.patch(`/quiz/questions/${id}/`, data)
export const deleteQuestion     = (id)                => api.delete(`/quiz/questions/${id}/`)

export const downloadQuestionTemplate = async () => {
  const res = await api.get('/quiz/questions/template/', { responseType: 'blob' })
  const url  = window.URL.createObjectURL(new Blob([res.data]))
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'savollar_shabloni.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export const importQuestions = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/quiz/questions/import/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const getGames           = (gid)               => api.get(`/groups/${gid}/games/`)
export const createGame         = (gid, data)         => api.post(`/groups/${gid}/games/`, data)
export const getGame            = (gid, gameId)       => api.get(`/groups/${gid}/games/${gameId}/`)
export const deleteGame         = (gid, gameId)       => api.delete(`/groups/${gid}/games/${gameId}/`)
export const startGame          = (gid, gameId)       => api.post(`/groups/${gid}/games/${gameId}/start/`)
export const pickSquare         = (gid, gameId, data) => api.post(`/groups/${gid}/games/${gameId}/pick/`, data)
export const answerQuestion     = (gid, gameId, data) => api.post(`/groups/${gid}/games/${gameId}/answer/`, data)
export const startFinal         = (gid, gameId, data) => api.post(`/groups/${gid}/games/${gameId}/final/`, data)
export const placeBet           = (gid, gameId, data) => api.post(`/groups/${gid}/games/${gameId}/bet/`, data)
export const answerFinal        = (gid, gameId, data) => api.post(`/groups/${gid}/games/${gameId}/final-answer/`, data)
export const finishGame         = (gid, gameId)       => api.post(`/groups/${gid}/games/${gameId}/finish/`)
export const resetGame          = (gid, gameId)       => api.post(`/groups/${gid}/games/${gameId}/reset/`)
export const duplicateGame      = (gid, gameId)       => api.post(`/groups/${gid}/games/${gameId}/copy/`)
export const swapTeamMembers    = (gid, gameId, data) => api.post(`/groups/${gid}/games/${gameId}/swap/`, data)
export const reshuffleTeams     = (gid, gameId)       => api.post(`/groups/${gid}/games/${gameId}/reshuffle/`)
