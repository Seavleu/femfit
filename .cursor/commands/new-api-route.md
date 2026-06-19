# New API Route

You will create a new API route under `/app/api/v1/`.

## Required steps

1. **Read the API spec.** Before writing any code, open `docs/04-api-spec.md`
   and check whether this endpoint or a similar one already exists. Follow the
   conventions documented there exactly.

2. **Ask me for these details** (if not provided):
   - HTTP method (GET, POST, PATCH, DELETE)
   - Path (e.g., `/api/v1/products`)
   - Purpose in one sentence
   - Auth level (public / authenticated / admin)
   - Expected request body shape (or "none" for GET)
   - Expected response shape

3. **Write the route file** at `app/api/v1/<path>/route.ts` with:
   - Zod schema for request validation
   - Auth check via Supabase `getUser()` (if not public)
   - Admin role check (if admin)
   - Idempotency-Key handling (if state-changing write)
   - Business logic delegated to `lib/<domain>/`
   - RFC 7807 problem+json error responses
   - Structured logging with `request_id`

4. **Add Zod schemas to `lib/<domain>/schemas.ts`** if they don't exist.

5. **Add business logic to `lib/<domain>/`**. Do not put logic in the route file.

6. **Write tests** in `lib/<domain>/<feature>.test.ts`:
   - Happy path
   - Validation failure
   - Auth failure
   - Edge cases (e.g., insufficient stock for orders, expired coupon)
   - Idempotency (if applicable)

7. **Update the API spec doc** (`docs/04-api-spec.md`) with the new endpoint.

8. **Run validation:** `pnpm typecheck && pnpm test`. Fix any failures.

## Pattern to follow

Match the structure of an existing route in `app/api/v1/`. Do not reinvent
patterns.

## Things to verify before saying you're done

- [ ] Route file follows the skeleton in `.cursor/rules/030-api.mdc`
- [ ] Zod validation on every input
- [ ] Auth check before any side effect
- [ ] Idempotency-Key handling if it's a write
- [ ] RFC 7807 error format
- [ ] Tests pass
- [ ] TypeScript strict-mode clean (no `any`)
- [ ] Docs updated
