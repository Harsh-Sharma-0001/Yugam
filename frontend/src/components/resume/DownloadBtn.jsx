import React, { useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { useReactToPrint } from "react-to-print";
import { useCoins } from '../../apis/user.api';

function DownloadBtn({ docRef, user, setUser }) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePdf = useReactToPrint({
        contentRef: docRef,
        documentTitle: "YugamPDF"
    });

    const handleDownload = async () => {
        if (isDownloading) return;

        try {
            setIsDownloading(true);
            const coinResponse = await useCoins({ coins: 10, action: "download-pdf" });

            await handlePdf();
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

    return (
        <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs text-white transition-opacity ${
                isDownloading ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800"
            }`}
        >
            <FiDownload />
            {isDownloading ? "Preparing PDF..." : "Download PDF"}
        </button>
    );
}

export default DownloadBtn;
