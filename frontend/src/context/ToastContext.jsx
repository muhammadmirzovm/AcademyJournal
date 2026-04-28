import { createContext, useContext, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
  }, [])

  const remove = (id) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 999 }}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: `4px solid ${t.type === 'success' ? 'var(--success)' : t.type === 'error' ? 'var(--danger)' : 'var(--accent)'}`,
                borderRadius: 8, padding: '12px 14px', minWidth: 280, maxWidth: 380,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {t.type === 'success' && <CheckCircle size={16} color="var(--success)" />}
              {t.type === 'error'   && <XCircle     size={16} color="var(--danger)"  />}
              {t.type === 'info'    && <AlertCircle  size={16} color="var(--accent)"  />}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.message}</span>
              <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={14} color="var(--text-muted)" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
