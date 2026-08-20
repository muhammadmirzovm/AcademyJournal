import api from './axios'

export const getMyBalance  = () => api.get('/coins/balance/')
export const getCoinReport = () => api.get('/coins/report/')
export const adjustCoins   = (data) => api.post('/coins/adjust/', data)
export const getCoinSettings    = () => api.get('/coins/settings/')
export const updateCoinSettings = (data) => api.patch('/coins/settings/', data)
export const getCoinLeaderboard = () => api.get('/coins/leaderboard/')
