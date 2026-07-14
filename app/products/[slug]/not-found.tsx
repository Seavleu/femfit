import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center px-3 py-16 text-center md:px-6">
      <div className="module max-w-md p-8 md:p-10">
        <p className="label-mono mb-3">404</p>
        <h1 className="title-serif mb-3">Product not found</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          The product you&apos;re looking for doesn&apos;t exist, or it may have been
          removed from our catalog.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn-solid">
            Browse all products
          </Link>
          <Link href="/" className="btn-ghost">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
