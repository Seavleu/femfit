# Cursor Context Setup — How To Use This Package

This is the FemFit context engineering bundle. Drop these files into your
project repository to give Cursor (and other AI coding tools) the context they
need to write good code for FemFit.

## What's Inside

```
femfit-context-setup/
├── AGENTS.md                    Cross-tool instructions (Cursor, Claude Code, Copilot)
├── README.md                    Project README with commands
├── .cursorignore                Tell Cursor what to skip
├── .env.example                 Required environment variables
│
├── .cursor/
│   ├── rules/                   Cursor rules (auto-applied by file pattern)
│   │   ├── 000-base.mdc         Always applied
│   │   ├── 010-money.mdc        Money handling
│   │   ├── 020-database.mdc     DB and Drizzle patterns
│   │   ├── 030-api.mdc          API route conventions
│   │   ├── 040-security.mdc     Webhooks, payments, auth
│   │   └── 050-testing.mdc      Testing standards
│   │
│   └── commands/                Slash commands (type "/new-api-route" in Cursor)
│       ├── new-api-route.md
│       └── new-table.md
│
└── docs/                        Authoritative project specifications
    ├── README.md                Doc index
    ├── 01-prd.md                Product Requirements
    ├── 02-system-design.md      System Design
    ├── 03-database-schema.md    Database Schema
    ├── 04-api-spec.md           API Specification
    └── 05-runbook.md            Operations Runbook
```

## Setup Steps

### 1. Initialize your project

```bash
# Create the femfit repo
mkdir femfit && cd femfit
git init

# Initialize Next.js
pnpm create next-app@latest . --typescript --tailwind --app --eslint
```

### 2. Drop these files into the repo root

Copy all files and directories from this bundle into your `femfit/` directory.
The structure should merge cleanly with the Next.js scaffold.

```bash
# From the femfit-context-setup directory:
cp -r AGENTS.md README.md .cursorignore .env.example .cursor docs /path/to/femfit/
```

### 3. Verify Cursor picks it up

Open the project in Cursor. Then:

1. Open Cursor settings → Rules.
2. You should see your `.cursor/rules/*.mdc` files listed.
3. The "base" rule should show as "always applied".
4. The other rules should show their glob patterns.

### 4. Test the context

In Cursor chat, type:

```
What technology stack should I use for this project?
```

If context is loaded correctly, the AI should answer with Next.js 15,
TypeScript strict, Drizzle, Supabase, ABA PayWay, etc. — referencing the
docs.

Then try a real prompt:

```
Implement the products list endpoint.
Read @docs/04-api-spec.md section 8.2 for the contract.
Read @docs/03-database-schema.md section 4.5 for the table.
Plan first, then implement.
```

The AI should:
1. Reference the spec
2. Use Drizzle ORM
3. Validate with Zod
4. Apply pagination
5. Return the documented response shape

If it does something else, your rules need tightening.

### 5. Set up Supabase MCP server (HIGHLY RECOMMENDED)

The Supabase MCP server gives Cursor direct access to your database — it can
read your schema, run queries, apply migrations, and check RLS policies on
your behalf. This dramatically improves the quality of database-related
suggestions.

**Setup:**

1. Get a Supabase personal access token:
   https://supabase.com/dashboard/account/tokens

2. Get your project ref from your Supabase URL:
   `https://[PROJECT_REF].supabase.co`

3. Copy `.cursor/mcp.json.example` to `.cursor/mcp.json`:
   ```bash
   cp .cursor/mcp.json.example .cursor/mcp.json
   ```

4. Fill in your tokens in `.cursor/mcp.json` (this file is gitignored).

5. Restart Cursor. Open Settings → Tools & MCP. You should see "supabase"
   with a green status and ~29 tools enabled.

6. Test it: in Cursor chat, ask "list all tables in my database." It should
   call the MCP server and return your schema.

**Safety:** The config starts with `--read-only`. Remove that flag only
when you trust Cursor to apply migrations directly. For learning and early
development, keep it read-only and apply migrations manually via
`pnpm db:migrate`.

### 6. Symlink for cross-tool compatibility

If anyone on the team uses Claude Code or Copilot:

```bash
ln -s AGENTS.md CLAUDE.md
ln -s AGENTS.md .cursorrules        # legacy Cursor format
ln -s AGENTS.md .github/copilot-instructions.md
```

This way, every tool reads the same source of truth.

## Customizing for Your Team

The context here is FemFit-specific. To adapt for another project:

1. **AGENTS.md** — replace project context, tech stack, hard rules.
2. **`.cursor/rules/`** — keep the structure (base, money, database, api,
   security, testing). Adapt content to your domain.
3. **`/docs`** — replace with your project's specs in the same five-document
   structure (PRD, System Design, Database Schema, API Spec, Runbook).

The structure is the value. The content is the customization.

## Maintenance

- **Update docs when behavior changes.** Stale docs are worse than no docs
  because the AI confidently follows them.
- **Update rules from incidents.** If the AI suggested something wrong and a
  human had to catch it, add a rule that would have prevented the mistake.
- **Review rules quarterly.** Some rules will be obsolete; some will need
  expansion.

## Recommended Reading

- [AGENTS.md spec](https://agents.md/) — the cross-tool standard
- [Cursor Rules docs](https://docs.cursor.com/context/rules) — official Cursor reference
- [coleam00/context-engineering-intro](https://github.com/coleam00/context-engineering-intro) — context engineering principles
- [PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) — community examples
- [blefnk/awesome-cursor-rules](https://github.com/blefnk/awesome-cursor-rules) — Next.js 15 / React 19 / Drizzle stack rules

## Why This Setup Works

1. **Layered context.** AGENTS.md gives universal context; Cursor rules give
   scoped rules per file pattern; `/docs` provides on-demand deep reference.
2. **Specific rules, not platitudes.** "Money is integer cents in columns
   ending in `_cents`" is actionable; "use consistent patterns" is not.
3. **Cross-tool compatible.** Works with Cursor today; works with Claude Code
   and Copilot tomorrow with one symlink.
4. **Source-controlled.** Rules and docs live in the repo, get reviewed in
   PRs, and don't drift the way Notion docs do.
5. **Project-specific.** Generic best-practices repos miss the constraints
   that matter most (your payment gateway, your customers' context, your
   architecture decisions).
