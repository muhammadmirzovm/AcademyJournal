import { useTranslation } from 'react-i18next'
import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SplashLoader from './components/SplashLoader'
import Landing from './pages/Landing'

const Register = lazy(() => import('./pages/Register'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Groups = lazy(() => import('./pages/Groups'))
const GroupDetail = lazy(() => import('./pages/GroupDetail'))
const LessonDetail = lazy(() => import('./pages/LessonDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const QuestionBank = lazy(() => import('./pages/QuestionBank'))
const GameBoard = lazy(() => import('./pages/GameBoard'))
const InviteLanding = lazy(() => import('./pages/InviteLanding'))
const Settings = lazy(() => import('./pages/Settings'))
const Students = lazy(() => import('./pages/Students'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Exams = lazy(() => import('./pages/Exams'))
const Rewards = lazy(() => import('./pages/Rewards'))
const CoinReport = lazy(() => import('./pages/CoinReport'))
const PurchaseScanner = lazy(() => import('./pages/PurchaseScanner'))

function AppShell() {
  const { t } = useTranslation()
  const { loading } = useAuth()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const min = setTimeout(() => setSplashDone(true), 1400)
    return () => clearTimeout(min)
  }, [])

  const done = splashDone && !loading

  return (
    <>
      <SplashLoader done={done} />
      {done && (
        <Layout>
          <Suspense fallback={<div role="status" style={{ padding: 24 }}>{t('common.loading')}</div>}>
          <Routes>
            <Route path="/"          element={<Landing />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/login"          element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/groups"    element={<ProtectedRoute roles={['teacher','admin']}><Groups /></ProtectedRoute>} />
            <Route path="/groups/:id" element={<ProtectedRoute roles={['teacher','admin','student']}><GroupDetail /></ProtectedRoute>} />
            <Route path="/groups/:groupId/lessons/:lessonId" element={<ProtectedRoute roles={['teacher','admin','student']}><LessonDetail /></ProtectedRoute>} />
            <Route path="/groups/:id/games/:gameId" element={<ProtectedRoute roles={['teacher','admin','student']}><GameBoard /></ProtectedRoute>} />
            <Route path="/questions" element={<ProtectedRoute roles={['teacher','admin']}><QuestionBank /></ProtectedRoute>} />
            <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/invite/:token"     element={<InviteLanding />} />
            <Route path="/settings"          element={<ProtectedRoute roles={['teacher','admin']}><Settings /></ProtectedRoute>} />
            <Route path="/students"          element={<ProtectedRoute roles={['admin','teacher']}><Students /></ProtectedRoute>} />
            <Route path="/exams"             element={<ProtectedRoute><Exams /></ProtectedRoute>} />
            <Route path="/rewards"           element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/coins/report"      element={<ProtectedRoute roles={['admin']}><CoinReport /></ProtectedRoute>} />
            <Route path="/scanner"           element={<ProtectedRoute roles={['admin']}><PurchaseScanner /></ProtectedRoute>} />
            <Route path="*"                  element={<NotFound />} />
          </Routes>
          </Suspense>
        </Layout>
      )}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
