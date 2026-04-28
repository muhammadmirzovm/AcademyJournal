import api from './axios'

export const getGroups          = ()                   => api.get('/groups/')
export const createGroup        = (data)               => api.post('/groups/', data)
export const getGroup           = (id)                 => api.get(`/groups/${id}/`)
export const updateGroup        = (id, data)           => api.patch(`/groups/${id}/`, data)
export const deleteGroup        = (id)                 => api.delete(`/groups/${id}/`)
export const joinGroup          = (join_key)           => api.post('/groups/join/', { join_key })
export const getMembers         = (id)                 => api.get(`/groups/${id}/members/`)
export const updateMembership   = (gid, mid, data)     => api.patch(`/groups/${gid}/members/${mid}/`, data)
export const removeMember       = (gid, mid)           => api.delete(`/groups/${gid}/members/${mid}/`)
export const giveCoins          = (gid, data)          => api.post(`/groups/${gid}/coins/`, data)

export const getLessons         = (gid)                => api.get(`/groups/${gid}/lessons/`)
export const createLesson       = (gid, data)          => api.post(`/groups/${gid}/lessons/`, data)
export const updateLesson       = (gid, lid, data)     => api.patch(`/groups/${gid}/lessons/${lid}/`, data)
export const deleteLesson       = (gid, lid)           => api.delete(`/groups/${gid}/lessons/${lid}/`)

export const getAttendance      = (gid, lid)           => api.get(`/groups/${gid}/lessons/${lid}/attendance/`)
export const saveAttendance     = (gid, lid, records)  => api.post(`/groups/${gid}/lessons/${lid}/attendance/`, { records })

export const getScores          = (gid, lid)           => api.get(`/groups/${gid}/lessons/${lid}/scores/`)
export const saveScores         = (gid, lid, records)  => api.post(`/groups/${gid}/lessons/${lid}/scores/`, { records })

export const getJournal         = (gid, lid)           => api.get(`/groups/${gid}/lessons/${lid}/journal/`)
export const saveJournal        = (gid, lid, body)     => api.post(`/groups/${gid}/lessons/${lid}/journal/`, { body })
