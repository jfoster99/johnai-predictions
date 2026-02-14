# Local Setup Complete! 🎉

Your JohnAI Predictions app is now running **100% locally** with all components containerized.

## Running Services

### Your Application
- **URL**: http://localhost:3000
- **Description**: Your React prediction markets app
- **Technology**: Nginx serving built Vite/React app

### Supabase Studio (Database UI)
- **URL**: http://localhost:3001
- **Description**: Visual database management interface
- **Credentials**: 
  - API URL: `http://localhost:8000`
  - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`

### Database
- **Host**: localhost
- **Port**: 5432 (internal only, not exposed)
- **Database**: postgres
- **User**: postgres
- **Password**: postgres

### API Gateway (Kong)
- **URL**: http://localhost:8000
- **Description**: Routes API requests to PostgREST
- **REST API**: http://localhost:8000/rest/v1/

## Services Architecture

```
┌─────────────────────────────────────────────────┐
│  Your Browser                                   │
│  - http://localhost:3000 (App)                  │
│  - http://localhost:3001 (Studio)               │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│  Docker Network (johnai-network)                │
│                                                  │
│  ┌────────────────┐      ┌──────────────────┐  │
│  │ johnai-        │      │ johnai-studio    │  │
│  │ predictions    │      │ (DB Management)  │  │
│  │ (React App)    │      └──────────────────┘  │
│  └────────┬───────┘                             │
│           │                                      │
│           ▼                                      │
│  ┌────────────────┐                             │
│  │ johnai-kong    │      API Gateway            │
│  │ (API Gateway)  │                             │
│  └────────┬───────┘                             │
│           │                                      │
│           ▼                                      │
│  ┌────────────────┐      ┌──────────────────┐  │
│  │ johnai-rest    │      │ johnai-meta      │  │
│  │ (PostgREST)    │◄─────┤ (DB Metadata)    │  │
│  └────────┬───────┘      └──────────────────┘  │
│           │                                      │
│           ▼                                      │
│  ┌────────────────┐                             │
│  │ johnai-        │                             │
│  │ postgres       │      PostgreSQL 15          │
│  │ (Database)     │                             │
│  └────────────────┘                             │
│                                                  │
│  Volume: postgres_data (persistent storage)     │
└──────────────────────────────────────────────────┘
```

## Common Commands

### Start Everything
```powershell
docker-compose up -d
```

### Stop Everything
```powershell
docker-compose down
```

### View Logs
```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f johnai-predictions
docker-compose logs -f postgres
docker-compose logs -f kong
```

### Restart a Service
```powershell
docker-compose restart johnai-predictions
```

### Rebuild After Code Changes
```powershell
docker-compose up -d --build johnai-predictions
```

### Reset Database (WARNING: Deletes all data)
```powershell
docker-compose down -v
docker-compose up -d
```

### Direct Database Access
```powershell
docker exec -it johnai-postgres psql -U postgres -d postgres
```

## Database Management

### Using Supabase Studio (Recommended)
1. Open http://localhost:3001
2. The database is automatically connected
3. Browse tables, run queries, manage data visually

### Using SQL Directly
```powershell
# Connect to database
docker exec -it johnai-postgres psql -U postgres

# Inside psql:
\dt          # List tables
\d users     # Describe users table
SELECT * FROM users;
```

### Run Migrations
Migrations are automatically run when the database starts for the first time from files in `supabase/migrations/`.

To add a new migration:
1. Create a new `.sql` file in `supabase/migrations/`
2. Run: `docker-compose down -v && docker-compose up -d` (this will reset the DB and run all migrations)

## Environment Variables

All configuration is in `.env`:
```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<local-key>
POSTGRES_*=<database credentials>
```

**Note**: After changing `.env`, you must rebuild:
```powershell
docker-compose up -d --build johnai-predictions
```

## Troubleshooting

### App shows blank page
1. Check logs: `docker-compose logs johnai-predictions`
2. Verify build included env vars: `docker-compose up -d --build`

### Database connection errors
1. Check if postgres is healthy: `docker-compose ps`
2. View logs: `docker-compose logs postgres`
3. Restart: `docker-compose restart postgres`

### Kong/API errors
1. Check kong config: `docker-compose logs kong`
2. Verify kong.yml is correctly mounted
3. Restart: `docker-compose restart kong rest`

### Port already in use
1. Find what's using the port: `netstat -ano | findstr :<PORT>`
2. Stop the conflicting service
3. Or change the port in docker-compose.yml

## Data Persistence

- Database data is stored in Docker volume `postgres_data`
- Data persists across container restarts
- To completely wipe data: `docker-compose down -v`

## Cloudflare Tunnel (Optional)

To expose your local app to the internet:

1. Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
2. Start with tunnel: `docker-compose --profile tunnel up -d`

The tunnel is in a separate profile so it doesn't start by default.

## Status Check

```powershell
# Quick health check
docker-compose ps

# All should show "Up" or "healthy"
```

---

**Everything is running locally!** No external dependencies except Docker.
