"use client";

import { useState } from "react";

export type ApiErrorDetail = {
  error: string;
  code?: string;
  status?: number;
  url?: string;
  timestamp?: string;
  [key: string]: unknown;
};

/**
 * Shared error display component with expandable technical details.
 * Use this across all forms and action panels for consistent error reporting.
 */
export function ErrorDisplay({
  error,
  onDismiss,
}: {
  error: string | ApiErrorDetail;
  onDismiss?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const isSimple = typeof error === "string";
  const message = isSimple ? error : error.error;
  const hasDetails = !isSimple && (error.code || error.status || error.url || Object.keys(error).length > 1);

  // Build copyable technical info
  const technicalInfo = !isSimple
    ? Object.entries(error)
        .filter(([key]) => key !== "error")
        .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
        .join("\n")
    : "";

  function copyToClipboard() {
    const fullText = `Error: ${message}\n${technicalInfo}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(fullText).catch(() => {
      // Fallback: select text in a textarea
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    });
  }

  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start justify-between">
        <p className="text-sm text-red-800">{message}</p>
        {onDismiss && (
          <button onClick={onDismiss} className="text-red-400 hover:text-red-600 ml-2 text-xs">
            ✕
          </button>
        )}
      </div>

      {hasDetails && (
        <div className="mt-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            {showDetails ? "Скрыть детали" : "Техническая информация"}
          </button>

          {showDetails && (
            <div className="mt-2 bg-red-100 rounded p-2">
              <pre className="text-xs text-red-900 whitespace-pre-wrap font-mono break-all">
                {technicalInfo}
              </pre>
              <button
                onClick={copyToClipboard}
                className="mt-2 text-xs bg-red-200 hover:bg-red-300 text-red-800 px-2 py-1 rounded"
              >
                📋 Скопировать для техподдержки
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
