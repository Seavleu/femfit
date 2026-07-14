import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Size Guide" };

const ROWS = [
  { size: "XS", bust: "76–81", waist: "58–63", hip: "84–89" },
  { size: "S", bust: "81–86", waist: "63–68", hip: "89–94" },
  { size: "M", bust: "86–91", waist: "68–73", hip: "94–99" },
  { size: "L", bust: "91–97", waist: "73–79", hip: "99–104" },
  { size: "XL", bust: "97–104", waist: "79–86", hip: "104–112" },
];

export default function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-3 pb-16 pt-8 md:px-6">
      <p className="label-mono mb-2">Fit</p>
      <h1 className="title-serif mb-6">Size guide</h1>
      <div className="module overflow-x-auto p-6 md:p-8">
        <p className="mb-6 text-sm text-muted-foreground">
          Measurements in centimetres. If you are between sizes, size up for
          high-impact training or size down for a compressive feel.
        </p>
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
              <th className="pb-3 pr-4">Size</th>
              <th className="pb-3 pr-4">Bust</th>
              <th className="pb-3 pr-4">Waist</th>
              <th className="pb-3">Hip</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.size} className="border-b border-border/60">
                <td className="py-3 pr-4 font-mono font-medium">{row.size}</td>
                <td className="py-3 pr-4 font-mono text-muted-foreground">{row.bust}</td>
                <td className="py-3 pr-4 font-mono text-muted-foreground">{row.waist}</td>
                <td className="py-3 font-mono text-muted-foreground">{row.hip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link href="/products" className="btn-ghost mt-8 inline-flex">
          ← Shop
        </Link>
      </div>
    </div>
  );
}
