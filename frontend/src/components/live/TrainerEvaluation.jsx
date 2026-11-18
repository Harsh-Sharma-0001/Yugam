import React from "react";
import { FiCheckCircle, FiChevronRight } from "react-icons/fi";

export default function TrainerEvaluation({
  showEndModal,
  sessionCompletedReport,
  overallScore,
  onReturnToDashboard,
}) {
  if (!showEndModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-3xl p-7 text-gray-900 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
            <FiCheckCircle size={28} />
          </div>
          <h3 className="text-lg font-black text-gray-900">Live Interview Concluded</h3>
          <p className="text-xs text-gray-500">
            The session has been finalized and saved into the institutional performance directory.
          </p>
        </div>

        {sessionCompletedReport?.evaluation && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
              <span className="text-xs text-gray-600 font-semibold">Overall Evaluation Score</span>
              <span className="text-2xl font-black text-emerald-600">
                {sessionCompletedReport.evaluation.overallScore || overallScore}/100
              </span>
            </div>

            {sessionCompletedReport.evaluation.summaryFeedback && (
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">
                  Faculty Feedback
                </span>
                <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  {sessionCompletedReport.evaluation.summaryFeedback}
                </p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onReturnToDashboard}
          className="w-full py-3.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-black transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Return to Dashboard</span>
          <FiChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
