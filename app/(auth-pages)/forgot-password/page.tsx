import { forgotPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

const inputClass =
  "h-12 rounded-xl border-border bg-card font-mono focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:ring-offset-0";

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <>
      <form className="module mx-auto flex w-full max-w-sm flex-col p-6 md:p-8">
        <div>
          <h1 className="title-serif">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-2"
              href="/sign-in"
            >
              Sign in
            </Link>
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-4 [&>input]:mb-0">
          <div>
            <Label htmlFor="email" className="label-mono mb-1.5 block">
              Email
            </Label>
            <Input
              name="email"
              placeholder="you@example.com"
              required
              className={inputClass}
            />
          </div>
          <SubmitButton
            formAction={forgotPasswordAction}
            className="btn-solid mt-2 w-full"
          >
            Reset Password
          </SubmitButton>
          <FormMessage message={searchParams} />
        </div>
      </form>
      <SmtpMessage />
    </>
  );
}
