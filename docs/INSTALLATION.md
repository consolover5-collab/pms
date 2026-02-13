# Installation Guide (Draft)

> **Note:** This is a draft installation guide. Full documentation to be completed.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm 8+

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd pms-auto

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
pnpm --filter @pms/db db:push
pnpm --filter @pms/db db:seed

# Start development servers
pnpm --filter @pms/api dev    # API on http://localhost:3001
pnpm --filter @pms/web dev    # Web on http://localhost:3000
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pms

# API
API_PORT=3001

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
DEFAULT_PROPERTY_ID=<your-property-id>
```

## Project Structure

```
pms-auto/
├── apps/
│   ├── api/          # Fastify API server
│   └── web/          # Next.js frontend
├── packages/
│   └── db/           # Drizzle ORM schema
├── docs/
│   └── help/         # User documentation
└── PLAN.md           # Implementation roadmap
```

## Database Setup

### Using Docker

```bash
docker run -d \
  --name pms-postgres \
  -e POSTGRES_USER=pms \
  -e POSTGRES_PASSWORD=pms \
  -e POSTGRES_DB=pms \
  -p 5432:5432 \
  postgres:16
```

### Schema Migration

```bash
# Apply schema changes
pnpm --filter @pms/db db:push

# Seed test data
pnpm --filter @pms/db db:seed
```

## Production Deployment

> TODO: Add production deployment instructions

## Troubleshooting

### Port already in use

```bash
# Kill existing processes
pkill -f "node.*3001"
pkill -f "node.*3000"
```

### Database connection issues

1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env
3. Ensure database exists

### API not responding

1. Check API logs: `pnpm --filter @pms/api dev`
2. Verify port 3001 is accessible
3. Check health endpoint: `curl http://localhost:3001/health`
