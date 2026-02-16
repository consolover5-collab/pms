"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  label,
}: {
  fallbackHref?: string;
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
