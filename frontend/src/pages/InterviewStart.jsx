import React from 'react'
import { Navigate } from 'react-router-dom'
import Step1setup from '../components/interview/Step1setup'

function InterviewStart({user , setUser}) {
  if (user && user.role && user.role !== "student") {
    return <Navigate to="/dashboard" replace />
  }
  return (
    <Step1setup user={user} setUser={setUser}/>
  )
}
export default InterviewStart
