import api from './axios'

export const purchaseReward = (rewardId, quantity) => api.post(`/rewards/${rewardId}/purchase/`, { quantity })
export const getMyPurchases = ()                    => api.get('/purchases/mine/')
