import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SplashLoader from './components/SplashLoader'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import LessonDetail from './pages/LessonDetail'
import Profile from './pages/Profile'
import QuestionBank from './pages/QuestionBank'
import GameBoard from './pages/GameBoard'
import NotFound from './pages/NotFound'

function AppShell() {
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
          <Routes>
            <Route path="/"          element={<Landing />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/groups"    element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
            <Route path="/groups/:groupId/lessons/:lessonId" element={<ProtectedRoute><LessonDetail /></ProtectedRoute>} />
            <Route path="/groups/:id/games/:gameId" element={<ProtectedRoute><GameBoard /></ProtectedRoute>} />
            <Route path="/questions" element={<ProtectedRoute><QuestionBank /></ProtectedRoute>} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="*"          element={<NotFound />} />
          </Routes>
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
