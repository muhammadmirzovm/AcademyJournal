import api from './axios'

export const getMyBalance = () => api.get('/coins/balance/')
