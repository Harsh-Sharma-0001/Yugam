import React, { useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { useReactToPrint } from "react-to-print";
import { useCoins, refundCoins } from '../../apis/user.api';

function DownloadBtn({ docRef, user, setUser, className, children }) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePdf = useReactToPrint({
        contentRef: docRef,
        documentTitle: "YugamPDF"
    });

    const handleDownload = async () => {
        if (isDownloading) return;

        const idempotencyKey = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        let coinsDeducted = false;

        try {
            setIsDownloading(true);
            const coinResponse = await useCoins({
                coins: 10,
                action: "download-pdf",
                idempotencyKey,
            });
            coinsDeducted = true;

            try {
                await handlePdf();
            } catch (printErr) {
                // If PDF generation fails after deduction, trigger automatic refund (P1-08)
                try {
                    const refundRes = await refundCoins({
                        action: "download-pdf",
                        originalIdempotencyKey: idempotencyKey,
                    });
                    if (refundRes?.interviewCoin !== undefined) {
                        setUser((prev) => ({
                            ...prev,
                            interviewCoin: refundRes.interviewCoin,
                        }));
                    }
                } catch (rfErr) {
                    console.error("Automatic coin refund failed:", rfErr);
                }
                throw printErr;
            }

            if (coinResponse?.interviewCoin !== undefined) {
                setUser((prev) => ({
                    ...prev,
                    interviewCoin: coinResponse.interviewCoin,
                }));
            }
        } catch (error) {
            if (error.response?.status === 402 || error.response?.status === 403) {
                return alert("Not enough Interview Coins. Please recharge your balance.");
            }
            alert(
                error.response?.data?.message ||
                "Something went wrong while downloading the PDF."
            );
        } finally {
            setIsDownloading(false);
        }
    };

    const defaultClass = `flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs text-white transition-opacity ${
        isDownloading ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800"
    }`;

    return (
        <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={className ? `${className} ${isDownloading ? "opacity-60 cursor-not-allowed" : ""}` : defaultClass}
        >
            <FiDownload className={isDownloading ? "animate-bounce" : ""} />
            {children || (isDownloading ? "Preparing PDF..." : "Download PDF")}
        </button>
    );
}

export default DownloadBtn;
