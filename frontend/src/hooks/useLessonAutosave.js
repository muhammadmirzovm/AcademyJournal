import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { saveAttendance, saveScores, setHomeworkAssignment } from '../api/groups'
import { createLessonAutosave } from '../utils/lessonAutosave'

export function useLessonAutosave(userId, groupId, lessonId) {
  const queue = useMemo(() => {
    let storage
    try { storage = window.sessionStorage } catch { /* Some browsers block local storage. */ }
    return createLessonAutosave({
      storage, storageKey: `lesson-draft:${userId}:${groupId}:${lessonId}`,
      send: (kind, payload) => {
        if (kind === 'attendance') return saveAttendance(groupId, lessonId, payload, { timeout: 15000 })
        if (kind === 'scores') return saveScores(groupId, lessonId, payload, { timeout: 15000 })
        return setHomeworkAssignment(groupId, lessonId, payload.assignment, payload.assignment_format, { timeout: 15000 })
      },
    })
  }, [userId, groupId, lessonId])
  const state = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  useEffect(() => {
    const leave = event => {
      if (queue.getSnapshot().pending) { event.preventDefault(); event.returnValue = '' }
    }
    const online = () => { if (queue.getSnapshot().status === 'error') queue.retry().catch(() => {}) }
    const hide = () => { if (document.visibilityState === 'hidden') queue.flush().catch(() => {}) }
    window.addEventListener('beforeunload', leave)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('beforeunload', leave)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', hide)
      // The queue survives tab/component navigation until its writes complete.
      queue.flush().catch(() => {})
    }
  }, [queue])
  return { queue, state }
}
