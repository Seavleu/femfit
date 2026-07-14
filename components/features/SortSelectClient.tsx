"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface SortOption {
  value: string;
  label: string;
}

export function SortSelectClient({
  current,
  options,
}: {
  current?: string;
  options: SortOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      id="sort"
      value={current ?? "newest"}
      onChange={handleChange}
      className="h-9 rounded-xl border border-border bg-card px-3 font-mono text-2xs uppercase tracking-[0.1em] text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
