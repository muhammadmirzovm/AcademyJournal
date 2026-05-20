import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'

const FULL_WIDTH_ROUTES = ['/login', '/register']
const NO_NAV_ROUTES    = []

export default function Layout({ children }) {
  const location = useLocation()
  const isFullWidth = FULL_WIDTH_ROUTES.some(r => location.pathname.startsWith(r))
  const hideNav     = NO_NAV_ROUTES.some(r => location.pathname.startsWith(r))

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!hideNav && <Navbar />}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={isFullWidth ? '' : 'page-main'}
        style={
          isFullWidth
            ? { flex: 1, width: '100%' }
            : { flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '28px 20px' }
        }
      >
        {children}
      </motion.main>
    </div>
  )
}
