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

export const getHomework        = (gid, lid)           => api.get(`/groups/${gid}/lessons/${lid}/homework/`)
export const saveHomework       = (gid, lid, body)     => api.post(`/groups/${gid}/lessons/${lid}/homework/`, { body })
export const setHomeworkAssignment = (gid, lid, assignment) => api.post(`/groups/${gid}/lessons/${lid}/homework/`, { assignment })

export const endLesson              = (gid, lid)           => api.post(`/groups/${gid}/lessons/${lid}/end/`)

export const getAcademyAnnouncements    = ()          => api.get('/announcements/')
export const createAcademyAnnouncement  = (data)      => api.post('/announcements/', data)
export const deleteAnnouncement         = (id)        => api.delete(`/announcements/${id}/`)
export const getGroupAnnouncements      = (gid)       => api.get(`/groups/${gid}/announcements/`)
export const createGroupAnnouncement    = (gid, data) => api.post(`/groups/${gid}/announcements/`, data)

export const getUpcomingExams = ()                  => api.get('/exams/upcoming/')
export const toggleExamReady  = (gid)              => api.post(`/groups/${gid}/exam-ready/`)
export const getExams         = (gid)              => api.get(`/groups/${gid}/exams/`)
export const createExam       = (gid, data)        => api.post(`/groups/${gid}/exams/`, data)
export const submitExam       = (gid, eid, data)   => api.post(`/groups/${gid}/exams/${eid}/submit/`, data)
export const finishExam       = (gid, eid)         => api.patch(`/groups/${gid}/exams/${eid}/`, { status: 'finished' })
