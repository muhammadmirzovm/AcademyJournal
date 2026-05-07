import { useEffect, useRef } from 'react'

const BOT_USERNAME = 'AcademyJournalBot'

export default function TelegramLoginButton({ onAuth, disabled }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || disabled) return
    ref.current.innerHTML = ''

    window.onTelegramAuth = onAuth

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-radius', '12')
    script.async = true
    ref.current.appendChild(script)

    return () => {
      delete window.onTelegramAuth
    }
  }, [onAuth, disabled])

  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />
}
