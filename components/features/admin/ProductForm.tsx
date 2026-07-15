"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProductDetails } from "@/lib/admin/catalog";
import {
  centsToDisplay,
  parseMoneyToCents,
  slugify,
} from "@/lib/admin/catalog-utils";

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-foreground/20";

export interface CategoryOption {
  id: string;
  name: string;
}

interface CreateProps {
  mode: "create";
  categories: CategoryOption[];
}

interface EditProps {
  mode: "edit";
  categories: CategoryOption[];
  product: {
    id: string;
    name: string;
    slug: string;
    categoryId: string | null;
    description: string | null;
    basePriceCents: number;
    compareAtPriceCents: number | null;
    isActive: boolean;
    isFeatured: boolean;
  };
}

type Props = CreateProps | EditProps;

export function ProductForm(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initial = props.mode === "edit" ? props.product : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(
    initial ? centsToDisplay(initial.basePriceCents) : ""
  );
  const [compareAt, setCompareAt] = useState(
    initial?.compareAtPriceCents != null
      ? centsToDisplay(initial.compareAtPriceCents)
      : ""
  );
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const basePriceCents = parseMoneyToCents(price);
    if (basePriceCents === null) {
      setError("Enter a valid price like 24.99");
      return;
    }
    const compareAtPriceCents = compareAt.trim()
      ? parseMoneyToCents(compareAt)
      : null;
    if (compareAt.trim() && compareAtPriceCents === null) {
      setError("Enter a valid compare-at price like 34.99");
      return;
    }

    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createProduct({
          name,
          slug: slug || undefined,
          categoryId: categoryId || null,
          description: description || null,
          basePriceCents,
          compareAtPriceCents,
          currency: "USD",
          isActive,
          isFeatured,
          primaryImageUrl: imageUrl.trim() || null,
          idempotencyKey: crypto.randomUUID(),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/admin/products/${result.data.productId}`);
        router.refresh();
        return;
      }

      const result = await updateProductDetails({
        productId: props.product.id,
        name,
        slug,
        categoryId: categoryId || null,
        description: description || null,
        basePriceCents,
        compareAtPriceCents,
        isActive,
        isFeatured,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="module max-w-2xl space-y-4 p-6 md:p-8">
      <label className="block space-y-1.5">
        <span className="label-mono">Name *</span>
        <input
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={inputClass}
          placeholder="Compression Leggings Pro"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="label-mono">Slug *</span>
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className={inputClass}
          placeholder="compression-leggings-pro"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="label-mono">Category</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass}
        >
          <option value="">Uncategorized</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="label-mono">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={`${inputClass} h-auto resize-none py-2`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label-mono">Price (USD) *</span>
          <input
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
            placeholder="24.99"
            inputMode="decimal"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label-mono">Compare at</span>
          <input
            value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            className={inputClass}
            placeholder="34.99"
            inputMode="decimal"
          />
        </label>
      </div>

      {props.mode === "create" && (
        <label className="block space-y-1.5">
          <span className="label-mono">Primary image URL</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={inputClass}
            placeholder="https://…"
            type="url"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border"
          />
          Active (visible in shop)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="rounded border-border"
          />
          Featured
        </label>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm text-muted-foreground" role="status">
          Changes saved.
        </p>
      )}

      <button type="submit" disabled={isPending} className="btn-solid">
        {isPending
          ? "Saving…"
          : props.mode === "create"
            ? "Create product"
            : "Save changes"}
      </button>
    </form>
  );
}
