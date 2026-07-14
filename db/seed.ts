import { db } from "@/db";
import {
  categories,
  products,
  productVariants,
  productImages,
} from "@/db/schema";
import { ensureAllDevAccounts } from "@/lib/dev/ensure";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SIZES = ["XS", "S", "M", "L", "XL"];
const COLORS = ["Black", "White", "Rose Pink", "Navy", "Sage"];

const CATEGORY_DATA = [
  { slug: "leggings", name: "Leggings", sortOrder: 1 },
  { slug: "sports-bras", name: "Sports Bras", sortOrder: 2 },
  { slug: "tank-tops", name: "Tank Tops", sortOrder: 3 },
  { slug: "shorts", name: "Shorts", sortOrder: 4 },
  { slug: "accessories", name: "Accessories", sortOrder: 5 },
];

const PRODUCT_DATA = [
  {
    categorySlug: "leggings",
    name: "Compression Leggings Pro",
    description: "High-waist compression leggings with four-way stretch fabric. Perfect for gymnastics, yoga, and everyday training. Moisture-wicking and quick-dry technology.",
    basePriceCents: 2999,
    compareAtPriceCents: 3999,
    isFeatured: true,
    colors: ["Black", "Navy", "Rose Pink"],
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    categorySlug: "leggings",
    name: "FlexFit Training Leggings",
    description: "Ultra-soft training leggings designed for maximum flexibility. Seamless waistband and hidden pocket. Ideal for high-intensity workouts.",
    basePriceCents: 2499,
    compareAtPriceCents: null,
    isFeatured: true,
    colors: ["Black", "Sage"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    categorySlug: "leggings",
    name: "Everyday Comfort Leggings",
    description: "Buttery-soft fabric meets functional design. Full-length cut with a wide waistband. From morning runs to evening errands.",
    basePriceCents: 1999,
    compareAtPriceCents: null,
    isFeatured: false,
    colors: ["Black", "White", "Navy"],
    sizes: ["XS", "S", "M", "L"],
  },
  {
    categorySlug: "sports-bras",
    name: "PowerSupport Sports Bra",
    description: "High-impact support bra with racerback design. Wide straps and double-layered cups for maximum confidence during any workout.",
    basePriceCents: 1899,
    compareAtPriceCents: 2499,
    isFeatured: true,
    colors: ["Black", "Rose Pink", "White"],
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    categorySlug: "sports-bras",
    name: "Minimal Bralette",
    description: "Light-support bralette perfect for yoga and pilates. Soft fabric with a flattering scoop neck. Wear alone or layer under tanks.",
    basePriceCents: 1499,
    compareAtPriceCents: null,
    isFeatured: false,
    colors: ["Black", "Sage", "Rose Pink"],
    sizes: ["S", "M", "L"],
  },
  {
    categorySlug: "tank-tops",
    name: "AeroFlow Training Tank",
    description: "Lightweight training tank with built-in shelf bra. Loose relaxed fit for unrestricted movement. Breathable mesh panels for ventilation.",
    basePriceCents: 1699,
    compareAtPriceCents: null,
    isFeatured: false,
    colors: ["Black", "White", "Navy"],
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    categorySlug: "tank-tops",
    name: "Sculpt Fitted Tank",
    description: "Body-hugging tank top that moves with you. Four-way stretch and moisture management. The perfect training essential.",
    basePriceCents: 1599,
    compareAtPriceCents: 1999,
    isFeatured: false,
    colors: ["Black", "Rose Pink", "Sage"],
    sizes: ["S", "M", "L"],
  },
  {
    categorySlug: "shorts",
    name: "ActiveFlow Training Shorts",
    description: "5-inch inseam training shorts with inner liner. Side pockets and elastic waistband. Built for speed and comfort.",
    basePriceCents: 1799,
    compareAtPriceCents: null,
    isFeatured: true,
    colors: ["Black", "Navy"],
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    categorySlug: "shorts",
    name: "High-Waist Biker Shorts",
    description: "7-inch inseam biker shorts with compression fit. High-waist design with tummy control. Versatile from studio to street.",
    basePriceCents: 2199,
    compareAtPriceCents: null,
    isFeatured: false,
    colors: ["Black", "Rose Pink", "Sage"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    categorySlug: "accessories",
    name: "Grip Training Socks",
    description: "Non-slip grip socks for gymnastics and yoga. Terry cushioning on the sole for comfort. Machine washable.",
    basePriceCents: 799,
    compareAtPriceCents: null,
    isFeatured: false,
    colors: ["Black", "White", "Rose Pink"],
    sizes: ["S", "M", "L"],
  },
  {
    categorySlug: "accessories",
    name: "Training Resistance Band Set",
    description: "Set of 3 fabric resistance bands — light, medium, and heavy. Non-slip design. Carry bag included.",
    basePriceCents: 1299,
    compareAtPriceCents: 1799,
    isFeatured: false,
    colors: ["Black"],
    sizes: ["M"],
  },
  {
    categorySlug: "accessories",
    name: "FemFit Water Bottle",
    description: "600ml insulated stainless steel bottle. Keeps drinks cold for 24 hours. Leak-proof lid with carry handle.",
    basePriceCents: 1599,
    compareAtPriceCents: null,
    isFeatured: false,
    colors: ["Black", "Rose Pink", "Sage"],
    sizes: ["M"],
  },
];

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeSku(productName: string, color: string, size: string) {
  const p = productName.substring(0, 6).toUpperCase().replace(/\s/g, "");
  const c = color.substring(0, 3).toUpperCase().replace(/\s/g, "");
  const s = size.toUpperCase().replace(/\s/g, "");
  return `${p}-${c}-${s}`;
}

function imageUrl(name: string, color: string) {
  const label = encodeURIComponent(`${name} ${color}`);
  return `https://placehold.co/600x800/E4E0DB/8A8880?text=${label}`;
}

async function seed() {
  console.log("Seeding FemFit database...\n");

  // ── Categories ──────────────────────────────────────────────────────────────
  console.log("Inserting categories...");
  const insertedCategories = await db
    .insert(categories)
    .values(
      CATEGORY_DATA.map((c) => ({
        slug: c.slug,
        name: c.name,
        sortOrder: c.sortOrder,
        isActive: true,
      }))
    )
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: categories.name, sortOrder: categories.sortOrder },
    })
    .returning({ id: categories.id, slug: categories.slug });

  const categoryMap = new Map(insertedCategories.map((c) => [c.slug, c.id]));
  console.log(`  ✓ ${insertedCategories.length} categories`);

  // ── Products, Variants, Images ───────────────────────────────────────────────
  console.log("\nInserting products...");
  let productCount = 0;
  let variantCount = 0;
  let imageCount = 0;

  for (const p of PRODUCT_DATA) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      console.warn(`  ⚠ Category not found: ${p.categorySlug}`);
      continue;
    }

    const slug = slugify(p.name);
    const sku = slugify(p.name).substring(0, 12).toUpperCase();

    const [inserted] = await db
      .insert(products)
      .values({
        sku,
        slug,
        categoryId,
        name: p.name,
        description: p.description,
        basePriceCents: p.basePriceCents,
        compareAtPriceCents: p.compareAtPriceCents ?? null,
        currency: "USD",
        isActive: true,
        isFeatured: p.isFeatured,
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: p.name,
          description: p.description,
          basePriceCents: p.basePriceCents,
          compareAtPriceCents: p.compareAtPriceCents ?? null,
          isFeatured: p.isFeatured,
          categoryId,
        },
      })
      .returning({ id: products.id });

    const productId = inserted.id;
    productCount++;

    // Variants: every size × color combination
    const variantValues = [];
    for (const color of p.colors) {
      for (const size of p.sizes) {
        const variantSku = makeSku(p.name, color, size);
        variantValues.push({
          productId,
          sku: variantSku,
          size,
          color,
          priceCents: null as number | null,
          stockQuantity: Math.floor(Math.random() * 20) + 5,
          isActive: true,
        });
      }
    }

    await db
      .insert(productVariants)
      .values(variantValues)
      .onConflictDoUpdate({
        target: productVariants.sku,
        set: { stockQuantity: productVariants.stockQuantity },
      });

    variantCount += variantValues.length;

    // One image per color (primary = first color)
    const imageValues = p.colors.map((color, i) => ({
      productId,
      url: imageUrl(p.name, color),
      altText: `${p.name} in ${color}`,
      sortOrder: i,
      isPrimary: i === 0,
    }));

    await db
      .insert(productImages)
      .values(imageValues)
      .onConflictDoNothing();

    imageCount += imageValues.length;

    console.log(`  ✓ ${p.name}`);
  }

  console.log(`\nSeed complete:`);
  console.log(`  ${productCount} products`);
  console.log(`  ${variantCount} variants`);
  console.log(`  ${imageCount} images`);

  // ── Dev accounts (dev1 customer, dev2 admin) ─────────────────────────────
  console.log("\nEnsuring explicit dev accounts...");
  await ensureAllDevAccounts();

  console.log(`\nRun pnpm dev and open http://localhost:3000`);
  console.log(`Sign in with Dev buttons on /sign-in (local only):`);
  console.log(`  dev1 (customer) → shop the store`);
  console.log(`  dev2 (admin)    → /admin full access`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});