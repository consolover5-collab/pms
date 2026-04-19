"use client";

import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dict } = useLocale();

  return (
    <main className="p-8 max-w-xl mx-auto mt-20">
      <div className="border-2 border-red-300 bg-red-50 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">
          {t(dict, "error.title")}
        </h2>
        <p className="text-red-700 mb-4">
          {error.message || t(dict, "error.unexpected")}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          {t(dict, "error.tryAgain")}
        </button>
      </div>
    </main>
  );
}
