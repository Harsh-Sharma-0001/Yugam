import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import Dashboard from './pages/Dashboard'
import Scorer from './pages/Scorer'
import ResumeBuilder from './pages/ResumeBuilder'
import InterviewStart from './pages/InterviewStart'
import InterviewPage from './pages/InterviewPage'
import InterviewReport from './pages/InterviewReport'
import Roadmap from './pages/Roadmap'
import Billing from './pages/Billing'
import LiveInterviewRoom from './pages/LiveInterviewRoom'
import { getCurrentUser, checkAuthStatus, AUTH_STATUS } from './apis/user.api'
import { getResume } from './apis/resume.api'
import { useDispatch } from 'react-redux'
import { setResume } from './redux/resumeSlice'

function ProtectedRoute({ user, loading, children }) {
  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-[#0E1016] flex items-center justify-center z-[9999]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const dispatch = useDispatch()
  const userFetchedRef = useRef(false)
  const resumeFetchedRef = useRef(false)

  useEffect(() => {
    const getUser = async () => {
      if (userFetchedRef.current) return;
      userFetchedRef.current = true;
      try {
        const authRes = await checkAuthStatus()
        if (authRes.status === AUTH_STATUS.AUTHENTICATED && authRes.user) {
          setUser(authRes.user)
        } else if (authRes.status === AUTH_STATUS.UNAUTHENTICATED) {
          setUser(null)
        } else if (authRes.status === AUTH_STATUS.NETWORK_ERROR) {
          console.warn("Transient error checking initial auth status:", authRes.error)
          setUser(null)
        }
      } catch (error) {
        console.error("Error fetching current user:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [])

  useEffect(() => {
    const getResumeData = async () => {
      if (resumeFetchedRef.current) return;
      resumeFetchedRef.current = true;
      try {
        const result = await getResume()
        const payload = result?.data ?? result?.resume ?? null;
        dispatch(setResume(payload))
      } catch (err) {
        console.log("Resume hydration skipped or not found:", err?.message)
      }
    }

    if (user && !resumeFetchedRef.current) {
      getResumeData()
    } else if (!user) {
      resumeFetchedRef.current = false;
      dispatch(setResume(null))
    }
  }, [user, dispatch])

  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full z-[9999]">
        <div className="h-1 bg-black animate-pulse w-full" />
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route 
          path='/' 
          element={user ? <Navigate to="/dashboard" replace /> : <Home setUser={setUser} />} 
        />

        <Route 
          path='/login' 
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage setUser={setUser} />} 
        />

        <Route 
          path='/signup' 
          element={user ? <Navigate to="/dashboard" replace /> : <SignupPage setUser={setUser} />} 
        />

        <Route 
          path='/dashboard' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Dashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/scorer' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Scorer user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/resume' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <ResumeBuilder user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/interview' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <InterviewStart user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/interview/:id' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <InterviewPage user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/interview/:id/report' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <InterviewReport user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/roadmap' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Roadmap user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/live-interview/:scheduleId' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <LiveInterviewRoom user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='/billing' 
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Billing user={user} setUser={setUser} />
            </ProtectedRoute>
          } 
        />

        <Route 
          path='*' 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </>
  )
}

export default App
