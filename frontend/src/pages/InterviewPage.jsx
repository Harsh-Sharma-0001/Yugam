import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { getInterview } from '../apis/interview.api'
import Step2interview from '../components/interview/Step2interview'
import { FiAlertCircle, FiArrowLeft } from 'react-icons/fi'

function InterviewPage({ user, setUser }) {
    if (user && user.role && user.role !== "student") {
        return <Navigate to="/dashboard" replace />
    }

    const { id } = useParams()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [interview, setInterview] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        let isMounted = true

        const fetchInterview = async () => {
            setLoading(true)
            setError(null)
            const response = await getInterview(id)

            if (!isMounted) return

            if (!response || !response.interview) {
                setError(response?.message || "Interview not found or failed to load.")
                setLoading(false)
                return
            }

            const data = response.interview
            const isLive = Boolean(
                data.isLive === true ||
                data.isLiveInterview === true ||
                String(data.mode).toUpperCase() === "LIVE" ||
                String(data.type).toUpperCase() === "LIVE"
            );

            // Live faculty sessions cannot be resumed in the AI mock interview player
            if (isLive) {
                navigate(`/dashboard?tab=interviews`, { replace: true })
                return
            }

            if (data.status === "completed") {
                navigate(`/interview/${id}/report`, { replace: true })
                return
            }

            const questions = Array.isArray(data.questions) ? data.questions : []
            if (questions.length > 0 && typeof data.currentQuestion === "number" && data.currentQuestion >= questions.length) {
                // If all questions are answered, route directly to report
                const hasUnanswered = questions.some(q => !q.userAnswer || !q.userAnswer.trim())
                if (!hasUnanswered) {
                    navigate(`/interview/${id}/report`, { replace: true })
                    return
                }
            }

            setInterview(data)
            setLoading(false)
        }

        fetchInterview()

        return () => {
            isMounted = false
        }
    }, [id, navigate])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07000F] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            </div>
        )
    }

    if (error || !interview) {
        return (
            <div className="min-h-screen bg-[#07000F] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-[#0E1016] border border-white/10 rounded-2xl p-6 text-center shadow-xl">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
                        <FiAlertCircle size={24} />
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">Unable to Load Interview</h2>
                    <p className="text-sm text-zinc-400 mb-6">{error || "The requested interview could not be found."}</p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition flex items-center gap-2"
                        >
                            <FiArrowLeft size={16} /> Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const questionsList = Array.isArray(interview.questions) ? interview.questions : [];
    let initialIndex = typeof interview.currentQuestion === 'number' ? interview.currentQuestion : 0;
    if (initialIndex >= questionsList.length && questionsList.length > 0) {
        const firstUnanswered = questionsList.findIndex(q => !q.userAnswer || !q.userAnswer.trim());
        initialIndex = firstUnanswered !== -1 ? firstUnanswered : 0;
    }
    const safeIndex = Math.min(Math.max(0, initialIndex), Math.max(0, questionsList.length - 1));
    const activeQuestion = questionsList[safeIndex] || questionsList[0] || {};

    return (
        <Step2interview
            interviewData={{
                interviewId: interview._id,
                role: interview.role || "Software Engineer",
                type: interview.type || "technical",
                currentQuestion: safeIndex,
                totalQuestions: questionsList.length || 1,
                questions: questionsList,
                question: activeQuestion,
                useResume: Boolean(interview.useResume),
                status: interview.status || "in-progress",
            }}
            user={user}
        />
    )
}

export default InterviewPage
