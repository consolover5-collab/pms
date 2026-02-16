"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  fallbackHref = "/",
  label,
}: {
  fallbackHref?: string;
  label: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-blue-600 hover:underline text-sm"
    >
      ← {label}
    </button>
  );
}
