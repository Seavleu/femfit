import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-femfit-mid">
        404
      </p>
      <h1 className="mb-3 text-3xl font-medium tracking-tight">
        Product not found
      </h1>
      <p className="mb-8 max-w-md text-sm text-femfit-mid">
        The product you&apos;re looking for doesn&apos;t exist, or it may have been
        removed from our catalog.
      </p>
      <div className="flex gap-3">
        <Link
          href="/products"
          className="rounded-md bg-femfit-charcoal px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Browse all products
        </Link>
        <Link
          href="/"
          className="rounded-md border border-femfit-charcoal px-6 py-3 text-sm font-medium text-femfit-charcoal transition-colors hover:bg-femfit-charcoal hover:text-white"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}