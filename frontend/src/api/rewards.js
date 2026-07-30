import api from './axios'

export const getRewards   = ()           => api.get('/rewards/')
export const createReward = (data)       => api.post('/rewards/', data)
export const updateReward = (id, data)   => api.patch(`/rewards/${id}/`, data)
export const deleteReward = (id)         => api.delete(`/rewards/${id}/`)
