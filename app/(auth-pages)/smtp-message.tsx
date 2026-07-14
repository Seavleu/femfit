import { ArrowUpRight, InfoIcon } from "lucide-react";
import Link from "next/link";

export function SmtpMessage() {
  return (
    <div className="module-muted flex gap-4 px-5 py-3">
      <InfoIcon size={16} className="mt-0.5 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <small className="text-sm text-muted-foreground">
          <strong className="text-foreground">Note:</strong> Emails are rate
          limited. Enable Custom SMTP to increase the rate limit.
        </small>
        <Link
          href="https://supabase.com/docs/guides/auth/auth-smtp"
          target="_blank"
          className="flex items-center gap-1 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Learn more <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
