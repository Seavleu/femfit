"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProductActive } from "@/lib/admin/actions";

interface Props {
  productId: string;
  field: "isActive";
  value: boolean;
}

export function ProductToggle({ productId, value }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleProductActive({ productId, isActive: !value });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? "bg-foreground" : "bg-muted"
      } ${isPending ? "opacity-50" : ""}`}
      aria-label={value ? "Deactivate" : "Activate"}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${
          value ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
