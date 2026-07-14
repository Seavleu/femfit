"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressRow,
} from "@/lib/account/addresses";
import { CAMBODIA_PROVINCES } from "@/lib/orders/schema";

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-foreground/20";

const emptyForm = {
  recipientName: "",
  phone: "+855",
  province: "",
  district: "",
  commune: "",
  village: "",
  streetDetail: "",
  landmark: "",
  isDefault: false,
};

interface Props {
  initialAddresses: AddressRow[];
}

export function AddressBook({ initialAddresses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const addresses = initialAddresses;
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(a: AddressRow) {
    setEditingId(a.id);
    setForm({
      recipientName: a.recipientName,
      phone: a.phone,
      province: a.province,
      district: a.district,
      commune: a.commune ?? "",
      village: a.village ?? "",
      streetDetail: a.streetDetail ?? "",
      landmark: a.landmark ?? "",
      isDefault: a.isDefault,
    });
    setShowForm(true);
    setError(null);
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        recipientName: form.recipientName,
        phone: form.phone,
        province: form.province,
        district: form.district,
        commune: form.commune || undefined,
        village: form.village || undefined,
        streetDetail: form.streetDetail || undefined,
        landmark: form.landmark || undefined,
        isDefault: form.isDefault,
      };

      const result = editingId
        ? await updateAddress(editingId, payload)
        : await createAddress(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setShowForm(false);
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this address?")) return;
    startTransition(async () => {
      const result = await deleteAddress(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultAddress(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 lg:max-w-2xl">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="module flex flex-col items-start gap-4 p-8">
          <p className="font-serif text-xl">No saved addresses yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Save a delivery address for faster checkout. Cambodian format:
            province → district → commune → village.
          </p>
          <button type="button" onClick={openCreate} className="btn-solid">
            Add address
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="module p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {a.recipientName}
                    {a.isDefault && (
                      <span className="ml-2 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{a.phone}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {[a.streetDetail, a.village, a.commune, a.district, a.province]
                      .filter(Boolean)
                      .join(", ")}
                    {a.landmark ? ` · Near ${a.landmark}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    disabled={isPending}
                    className="btn-ghost text-xs"
                  >
                    Edit
                  </button>
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(a.id)}
                      disabled={isPending}
                      className="btn-ghost text-xs"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    disabled={isPending}
                    className="font-mono text-2xs uppercase tracking-[0.1em] text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!showForm && (
            <button type="button" onClick={openCreate} className="btn-ghost">
              + Add another address
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="module space-y-4 p-6 md:p-8">
          <p className="label-mono">{editingId ? "Edit address" : "New address"}</p>

          <label className="block space-y-1.5">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              Recipient name
            </span>
            <input
              required
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              Phone
            </span>
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass}
              placeholder="+855…"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              Province
            </span>
            <select
              required
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
              className={inputClass}
            >
              <option value="">Select province</option>
              {CAMBODIA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              District
            </span>
            <input
              required
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                Commune
              </span>
              <input
                value={form.commune}
                onChange={(e) => setForm({ ...form, commune: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                Village
              </span>
              <input
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              Street / house detail
            </span>
            <input
              value={form.streetDetail}
              onChange={(e) => setForm({ ...form, streetDetail: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              Landmark (helps couriers)
            </span>
            <input
              value={form.landmark}
              onChange={(e) => setForm({ ...form, landmark: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-border"
            />
            Set as default delivery address
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isPending} className="btn-solid">
              {isPending ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
