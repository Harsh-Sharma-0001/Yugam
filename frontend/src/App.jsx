import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Scorer from './pages/Scorer'
import ResumeBuilder from './pages/ResumeBuilder'
import InterviewStart from './pages/InterviewStart'
import InterviewPage from './pages/InterviewPage'
import InterviewReport from './pages/InterviewReport'
import Roadmap from './pages/Roadmap'
import Billing from './pages/Billing'
import LiveInterviewRoom from './pages/LiveInterviewRoom'
import { getCurrentUser } from './apis/user.api'
import { getResume } from './apis/resume.api'
import { useDispatch } from 'react-redux'
import { setResume } from './redux/resumeSlice'

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
        const data = await getCurrentUser()
        setUser(data?.user || null)
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
          path='/dashboard' 
          element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/scorer' 
          element={user ? <Scorer user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/resume' 
          element={user ? <ResumeBuilder user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/interview' 
          element={user ? <InterviewStart user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/interview/:id' 
          element={user ? <InterviewPage user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/interview/:id/report' 
          element={user ? <InterviewReport user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/roadmap' 
          element={user ? <Roadmap user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/live-interview/:scheduleId' 
          element={user ? <LiveInterviewRoom user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />

        <Route 
          path='/billing' 
          element={user ? <Billing user={user} setUser={setUser} /> : <Navigate to="/" replace />} 
        />
      </Routes>
    </>
  )
}

export default App
