"use client";

import { useRouter } from "next/navigation";

/**
 * Back button that uses browser history, preserving filters/scroll position.
 * Falls back to the provided href if there's no history.
 */
export function BackButton({
  fallbackHref,
  label,
}: {
  fallbackHref: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="text-blue-600 hover:underline text-sm"
    >
      ← {label}
    </button>
  );
}
