"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SearchBarClientProps {
  defaultValue?: string;
  size?: "small" | "large";
  autoFocus?: boolean;
}

export function SearchBarClient({
  defaultValue = "",
  size = "small",
  autoFocus = false,
}: SearchBarClientProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const inputClass =
    size === "large"
      ? "h-14 pl-14 pr-4 text-base"
      : "h-10 pl-10 pr-3 text-sm";

  return (
    <form onSubmit={handleSubmit} role="search" className="relative">
      <span
        className={`absolute ${
          size === "large" ? "left-5 top-1/2" : "left-3 top-1/2"
        } -translate-y-1/2 text-femfit-mid`}
        aria-hidden="true"
      >
        <SearchIcon size={size === "large" ? 20 : 16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          size === "large"
            ? "Search for leggings, sports bras, accessories…"
            : "Search products…"
        }
        autoFocus={autoFocus}
        className={`w-full rounded-md border border-femfit-border bg-femfit-warm ${inputClass} text-foreground placeholder:text-femfit-mid focus:border-femfit-charcoal focus:outline-none focus:ring-1 focus:ring-femfit-charcoal`}
        aria-label="Search products"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-femfit-mid hover:bg-femfit-gray hover:text-foreground`}
          aria-label="Clear search"
        >
          <CloseIcon />
        </button>
      )}
    </form>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}