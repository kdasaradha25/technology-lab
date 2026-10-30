# Frontend Application 03 — Angular

## Objective
Build a simple single-page backend and database health monitoring application using modern Angular.

Use modern Angular, not legacy AngularJS.

## Technology requirements
- Modern Angular
- TypeScript
- Angular standalone components
- Angular HttpClient
- CSS

## Application requirements

Create one page titled:

"Backend & Database Health Monitor"

### 1. Backend configuration

Allow the user to configure or select a backend API URL.

Include sample configurations for:
- Django + PostgreSQL
- FastAPI + MySQL
- Express.js + MongoDB
- Go + Cassandra
- PHP + SQLite
- Python + Redis + InfluxDB

### 2. Health checks

Create four buttons:

- Check API Health
- Check Application Health
- Check Database Health
- Check All

Call the following endpoints:

- `/health`
- `/health/app`
- `/health/db`

### 3. Results section

Display:
- Backend service name
- API status
- Application status
- Database status
- Database type
- HTTP status code
- Response time in milliseconds
- Last checked time
- Raw JSON response

### 4. UI states

Support:
- Healthy
- Unhealthy
- Loading
- Connection failed
- Request timeout
- Invalid API URL

### 5. Angular implementation requirements
- Use Angular HttpClient.
- Use a service for API requests.
- Use standalone components.
- Keep the implementation minimal.
- Use proper TypeScript interfaces for API responses.
- Handle HTTP errors.
- Avoid unnecessary modules, services, and architectural complexity.
- Do not introduce authentication or routing for additional pages.

## Design requirements
- Single-page responsive UI.
- Simple status cards.
- Clear visual indicators.
- Clean layout.
- No unnecessary animations or complex dashboard features.

## Deliverables
- Complete Angular source code.
- `package.json`
- `angular.json`
- `.gitignore`
- `README.md`

## Testing
- Verify all three health endpoints.
- Test healthy and unhealthy responses.
- Test invalid URLs and network failures.
- Verify compatibility with the different backend API implementations.

Build, execute, and verify the project.