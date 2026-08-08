import api from './axios'

export const getMyBalance  = () => api.get('/coins/balance/')
export const getCoinReport = () => api.get('/coins/report/')
