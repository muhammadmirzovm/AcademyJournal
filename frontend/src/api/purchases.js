import api from './axios'

export const purchaseReward  = (rewardId, quantity) => api.post(`/rewards/${rewardId}/purchase/`, { quantity })
export const getMyPurchases  = ()                    => api.get('/purchases/mine/')
export const lookupPurchase  = (code)                => api.get(`/purchases/lookup/${encodeURIComponent(code)}/`)
export const issuePurchase   = (id)                  => api.post(`/purchases/${id}/issue/`)
