# FemFit

Online store for gymnastic and activewear apparel, serving Cambodia.

## Quick Links for Engineering

- **[Documentation](./docs)** — full project specifications
- **[AGENTS.md](./AGENTS.md)** — instructions for AI coding tools
- **[Cursor Rules](./.cursor/rules)** — scoped rules for Cursor IDE

## Documentation

| Document | Purpose |
|---|---|
| [Product Requirements](./docs/01-prd.md) | What we're building and why |
| [System Design](./docs/02-system-design.md) | Architecture and tech stack |
| [Database Schema](./docs/03-database-schema.md) | Data model (authoritative) |
| [API Specification](./docs/04-api-spec.md) | REST contract (authoritative) |
| [Runbook](./docs/05-runbook.md) | Operations and incident response |

## Tech Stack

- **Framework:** Next.js 15 + React 19 + TypeScript (strict)
- **UI:** Tailwind CSS + shadcn/ui
- **ORM:** Drizzle
- **Database / Auth / Storage:** Supabase
- **Hosting:** Vercel (Singapore region)
- **CDN:** Cloudflare
- **Payments:** ABA PayWay + Cash on Delivery
- **Email:** Resend; **SMS:** Twilio → local provider

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in values from your Supabase project, ABA sandbox, etc.

# Run database migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Common Commands

```bash
pnpm dev          # Dev server
pnpm build        # Production build
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint
pnpm test         # Unit + integration tests (Vitest)
pnpm test:e2e     # End-to-end tests (Playwright)
pnpm db:generate  # Generate migration from schema changes
pnpm db:migrate   # Apply pending migrations
pnpm db:seed      # Seed development data
```

## Working with AI Coding Tools

This repo is set up for AI-assisted development with proper context engineering:

- **`AGENTS.md`** is the cross-tool entry point (Cursor, Claude Code, Copilot, etc.)
- **`.cursor/rules/`** contains scoped rules for Cursor (auto-applied by file path)
- **`/docs`** contains the authoritative specifications referenced by the rules

When prompting an AI tool to implement something substantial:

1. Reference the relevant doc explicitly: `@docs/04-api-spec.md`
2. State the requirement and constraints
3. Ask for a plan first, then implementation
4. Require validation: `pnpm typecheck && pnpm test` must pass

Example prompt:

> I need to implement `POST /api/v1/orders`.
> Read @docs/04-api-spec.md §8.4 and @docs/03-database-schema.md §4.10.
>
> Requirements:
> - Idempotency-Key header required
> - SELECT FOR UPDATE on variants inside a transaction
> - Snapshot product name and price into order_items
> - Return order + payment intent (with ABA redirect URL)
>
> Plan first, then implement. After implementing, run:
> - `pnpm typecheck`
> - `pnpm test orders`
>
> Fix any issues until both pass.

## Contributing

- Open a feature branch from `main`
- Write or update tests for any business logic
- Update relevant docs in `/docs` if behavior changes
- PR includes a description of what changed and why
- Anything touching `lib/payments/`, `app/api/v1/webhooks/`, or `app/api/v1/auth/` requires a human reviewer who understands payments

## License

Proprietary. © FemFit.
