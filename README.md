# Orbit

Orbit is an AI workspace for growing a personal brand on LinkedIn. You chat with it to plan and write posts in your own voice, then refine them in a post editor, add visuals, and keep a steady posting rhythm.

## Features

- **Chat that writes in your voice.** An agent with long-term memory (identity, voice, writing rules, strategy) drafts posts, proposes edits and keeps versions.
- **Writing engine.** Your own writing style compiled from posts you paste or a LinkedIn export, hard writing rules checked in code, a hook library with varied hook cards, format selection, a polish pass and post analysis with ranked fixes.
- **Knowledge base.** Upload documents and links; hybrid search (vector + full text) lets the agent use your own material.
- **Post editor.** Document mode with live phone/tablet/desktop previews, readability readout, versions and a resizable chat column.
- **Visuals.** Generate and edit post images with OpenAI image models, plus an image library.
- **Carousels, posts board and calendar, analytics, engagement queue, activities and a 30-day sprint, idea feed.**
- **Safety.** Moderation, an on-topic guard, per-user rate limits and a daily cost cap.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) in a pnpm + Turborepo monorepo
- [Vercel AI SDK](https://ai-sdk.dev) with OpenAI models
- PostgreSQL ([Neon](https://neon.tech)) with Prisma 7 and pgvector
- [Clerk](https://clerk.com) for auth
- Upstash Blob (files), Upstash Redis (rate limits), Resend (email)
- Tailwind CSS 4, Motion

## Repository layout

```
apps/
  web/            Next.js app: marketing pages, sign-in, the app and API routes
packages/
  agent/          Chat agent: context, tools, history window, specialists, eval
  ai/             Model provider, embeddings, usage limits
  db/             Prisma schema, migrations, services
  knowledge/      Document parsing, chunking, hybrid search
  visuals/        Image generation providers and prompts
  storage/        Blob storage (Upstash or local disk)
  jobs/           Background job runner
  ui/             Design system (tokens, primitives, logo)
  config/         Shared TypeScript and ESLint config
docs/             Design system, feature designs and plans
```

## Getting started

Requirements: Node.js 22.19+, pnpm 11, a PostgreSQL database with pgvector (Neon works), a Clerk app and an OpenAI API key.

```bash
pnpm install
cp .env.example .env        # then fill in the values
pnpm db:migrate             # apply migrations
pnpm db:seed                # optional seed data
pnpm dev                    # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate database for tests (name must end in `_test`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk auth |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Auth routes (`/sign-in`, `/sign-up`) |
| `OPENAI_API_KEY` | Chat, embeddings and images |
| `UPSTASH_BLOB_TOKEN` | Public file storage |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limits and cost cap |
| `RESEND_API_KEY` | Email |
| `APP_URL` | The app's public origin |
| `VISUALS_PROVIDER` | `openai` (default when a key is set) or `mock` |

Optional switches: `DEEPGRAM_ENABLED` (voice transcription, off by default), `LINKEDIN_PUBLISH_ENABLED` (off by default), `VISUALS_PAUSED`, `AI_MODEL_GENERATE`, `AI_MODEL_EXTRACT`.

## Testing

```bash
pnpm test                                  # unit tests (Vitest)
pnpm --filter @brandloop/web dev:e2e       # app on :3100 against the test DB with a scripted model
pnpm --filter @brandloop/web e2e           # Playwright end-to-end tests
```

The e2e server only starts against a database whose name ends in `_test` and never calls paid AI or image APIs.

## Deployment

The app deploys to Vercel from `main` with the project root set to `apps/web`. Set the environment variables above in the Vercel project; the Prisma client is generated during the build.

## License

All rights reserved.
