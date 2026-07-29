import api from './axios'

export const getRewards   = ()     => api.get('/rewards/')
export const createReward = (data) => api.post('/rewards/', data)
