import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getInterview } from '../apis/interview.api'
import Step2interview from '../components/interview/Step2interview'
import { FiAlertCircle, FiArrowLeft } from 'react-icons/fi'

function InterviewPage({ user, setUser }) {
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
            if (data.status === "completed") {
                navigate(`/interview/${id}/report`, { replace: true })
                return
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

    return (
        <Step2interview
            interviewData={{
                interviewId: interview._id,
                currentQuestion: interview.currentQuestion,
                totalQuestions: interview.questions?.length || 0,
                question: interview.questions?.[interview.currentQuestion],
            }}
            user={user}
        />
    )
}

export default InterviewPage
