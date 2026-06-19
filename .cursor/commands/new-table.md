# New Database Table

You will add a new table to the FemFit schema.

## Required steps

1. **Read the schema doc.** Open `docs/03-database-schema.md` and check whether
   the entity you're about to add already exists or should extend an existing
   one. Read the naming conventions and design principles.

2. **Ask me for these details** (if not obvious from context):
   - Table name (plural, snake_case)
   - Purpose
   - Owner module (catalog, orders, payments, etc.)
   - Required columns and their types
   - Foreign keys and their ON DELETE behavior
   - Indexes that should exist
   - RLS policies (who can read/write)

3. **Add the Drizzle schema** to `db/schema.ts`:
   - UUID primary key
   - `created_at`, `updated_at` as `timestamptz`
   - Money columns as integer with names ending in `_cents` and CHECK >= 0
   - Foreign keys with explicit ON DELETE
   - Check constraints for enum-like fields
   - `updated_at` trigger if mutable

4. **Generate the migration:** `pnpm db:generate`.

5. **Review the generated SQL.** Do not trust auto-generation blindly. Confirm:
   - Foreign key ON DELETE is correct
   - Defaults are correct
   - Indexes are created
   - Check constraints are present
   - Generated columns (e.g., tsvector) are correct

6. **Add RLS policies** in a separate migration or in the same file:
   ```sql
   alter table public.<table> enable row level security;

   create policy <table>_select_own on public.<table>
     for select using (auth.uid() = user_id);
   -- ... etc
   ```

7. **Update `docs/03-database-schema.md`** with:
   - The table's purpose
   - Full DDL
   - Indexes and rationale
   - RLS policies

8. **Test the migration** locally:
   ```bash
   pnpm db:migrate
   psql $DATABASE_URL -c "\d+ <table_name>"
   ```

## Things to verify

- [ ] UUID primary key with `defaultRandom()`
- [ ] `timestamptz` for all times (not naive `timestamp`)
- [ ] Money columns are `integer` with name ending in `_cents`
- [ ] Foreign keys have explicit ON DELETE behavior
- [ ] Indexes exist for foreign keys (for join performance)
- [ ] Partial indexes where filters are consistent
- [ ] RLS policies for user-owned tables
- [ ] Updated `docs/03-database-schema.md`
- [ ] Migration runs cleanly
