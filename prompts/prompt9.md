# Frontend Application 02 — Next.js

## Objective
Build a simple single-page backend and database health monitoring application using Next.js.

This is an independent project. Do not reuse the React/Vite application as a Next.js application.

## Technology requirements
- Next.js
- React
- TypeScript
- App Router
- CSS or a lightweight styling solution

## Application requirements

Create one page titled:

"Backend & Database Health Monitor"

The page should provide:

### 1. Backend configuration
Allow users to enter a backend API base URL.

Provide sample configurations for:
- Django + PostgreSQL
- FastAPI + MySQL
- Express.js + MongoDB
- Go + Cassandra
- PHP + SQLite
- Python + Redis + InfluxDB

### 2. Health checks

Create buttons for:

- Check API Health
- Check Application Health
- Check Database Health
- Check All

Connect directly to the backend endpoints:

- `/health`
- `/health/app`
- `/health/db`

### 3. Results

Display:
- Backend service name
- API health
- Application health
- Database health
- Database type
- HTTP response code
- Response time
- Last checked time
- Raw JSON response

### 4. UI states
Handle:
- Healthy
- Unhealthy
- Loading
- Network error
- Timeout
- Invalid URL

### 5. Technical requirements
- Use client-side interactions where needed.
- Use Next.js App Router.
- Keep the page simple.
- Do not create unnecessary API routes or backend proxy functionality.
- Communicate with the external backend APIs directly from the browser.
- Handle CORS properly.
- Use environment variables only for non-secret public configuration.

## Design
- One responsive page.
- Simple status cards.
- Clear status indicators.
- Minimal navigation.
- No login or authentication.
- No additional pages.

## Deliverables
- Complete source code.
- `package.json`
- `.env.example`
- `.gitignore`
- `README.md`

## Testing
- Verify all three health endpoints.
- Verify successful and failed connections.
- Test with multiple backend URLs.
- Confirm that the application works independently of the backend projects.

Build, execute, and verify the project.