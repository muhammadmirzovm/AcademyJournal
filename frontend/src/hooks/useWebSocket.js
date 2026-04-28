import { useEffect, useRef, useCallback } from 'react'

// In dev, VITE_WS_URL is empty → Vite proxy handles /ws/* → ws://localhost:8000
// In prod, VITE_WS_URL=wss://your-backend.fly.dev
const WS_BASE = import.meta.env.VITE_WS_URL || ''

export function useWebSocket(path, { onMessage, enabled = true } = {}) {
  const wsRef      = useRef(null)
  const onMsgRef   = useRef(onMessage)
  onMsgRef.current = onMessage

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    if (!enabled || !path) return

    const token = localStorage.getItem('access')
    const url   = `${WS_BASE}${path}${token ? `?token=${token}` : ''}`
    const ws    = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        onMsgRef.current?.(msg)
      } catch { /* ignore parse errors */ }
    }

    // Ping every 25 s to keep connection alive through load balancers
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
    }, 25_000)

    return () => {
      clearInterval(ping)
      ws.close()
    }
  }, [path, enabled])

  return { send }
}
