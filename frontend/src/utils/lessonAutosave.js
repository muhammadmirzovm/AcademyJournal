// Merge only edited students, so one teacher does not overwrite unrelated rows.
export function mergeRecords(existing = [], updates = [], field) {
  const rows = new Map(existing.map(row => [row.student, row]))
  for (const row of updates) {
    if (field === 'value' && row.value === null) rows.delete(row.student)
    else rows.set(row.student, { ...rows.get(row.student), ...row })
  }
  return [...rows.values()]
}

function mergePayload(kind, older, newer) {
  if (kind === 'homework') return newer
  return [...new Map([...(older || []), ...newer].map(row => [row.student, row])).values()]
}

export function createLessonAutosave({ send, storage, storageKey }) {
  const pending = new Map()
  const listeners = new Set()
  const lastPayload = new Map()
  const waiters = new Set()
  let flight = null
  let failure = null
  let timer = null
  let started = false
  let snapshot = { status: 'idle', pending: false, revision: 0 }

  const work = () => {
    const values = flight ? { [flight.kind]: flight.payload } : {}
    for (const [kind, entry] of pending) values[kind] = mergePayload(kind, values[kind], entry.payload)
    return values
  }
  const publish = () => {
    const values = work()
    const dirty = Object.keys(values).length > 0
    try {
      if (dirty) storage?.setItem(storageKey, JSON.stringify(values))
      else storage?.removeItem(storageKey)
    } catch { /* Autosave still works if browser draft storage is unavailable. */ }
    snapshot = { status: failure ? 'error' : dirty ? 'saving' : 'saved', pending: dirty, revision: snapshot.revision + 1 }
    for (const listener of listeners) listener()
    if (failure || !dirty) {
      for (const waiter of waiters) {
        if (failure) waiter.reject(failure)
        else waiter.resolve()
      }
      waiters.clear()
    }
  }
  const schedule = () => {
    clearTimeout(timer)
    if (flight || failure || !pending.size) return
    const due = Math.min(...[...pending.values()].map(entry => entry.due))
    timer = setTimeout(pump, Math.max(0, due - Date.now()))
  }
  async function pump() {
    if (flight || failure || !pending.size) return
    const [kind, entry] = [...pending].sort((a, b) => a[1].due - b[1].due)[0]
    if (entry.due > Date.now()) { schedule(); return }
    pending.delete(kind)
    flight = { kind, payload: entry.payload }
    publish()
    try {
      await send(kind, entry.payload)
      flight = null
    } catch (error) {
      // Retry the failed edit together with newer values; newer rows win.
      const newer = pending.get(kind)
      pending.set(kind, { payload: mergePayload(kind, entry.payload, newer?.payload ?? entry.payload), due: Date.now() })
      flight = null
      failure = error
    }
    publish()
    schedule()
  }
  const enqueue = (kind, payload, delay = 0) => {
    if (kind !== 'homework' && !payload.length) return
    const signature = JSON.stringify(payload)
    if (!failure && lastPayload.get(kind) === signature) return
    lastPayload.set(kind, signature)
    const existing = pending.get(kind)
    pending.set(kind, { payload: mergePayload(kind, existing?.payload, payload), due: Date.now() + delay })
    failure = null
    publish()
    schedule()
  }
  const flush = () => {
    for (const entry of pending.values()) entry.due = Date.now()
    if (failure) return Promise.reject(failure)
    if (!flight && !pending.size) return Promise.resolve()
    const result = new Promise((resolve, reject) => waiters.add({ resolve, reject }))
    schedule()
    return result
  }
  return {
    enqueue, flush, work,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => snapshot,
    retry: () => { failure = null; publish(); return flush() },
    restore: memberIds => {
      if (!started) {
        started = true
        let values = {}
        try { values = JSON.parse(storage?.getItem(storageKey) || '{}') } catch { /* Ignore a corrupt local draft. */ }
        const allowed = new Set(memberIds)
        for (const kind of ['attendance', 'scores']) {
          if (Array.isArray(values?.[kind])) {
            const field = kind === 'attendance' ? 'present' : 'value'
            const rows = values[kind].filter(row => row && allowed.has(row.student) && (field === 'present' ? typeof row.present === 'boolean' : row.value === null || (Number.isInteger(row.value) && row.value >= 0 && row.value <= 5)))
            if (rows.length) enqueue(kind, rows)
          }
        }
        if (typeof values?.homework?.assignment === 'string' && ['plain', 'html'].includes(values.homework.assignment_format)) enqueue('homework', values.homework)
      }
      return work()
    },
  }
}
