# Frontend Application 01 — React.js

## Objective
Build a simple single-page application using React.js that can monitor the health of different backend APIs and their databases.

## Technology requirements
- React.js
- Vite
- JavaScript or TypeScript
- CSS
- Fetch API or Axios

Use React with Vite. Do not use Next.js.

## Single-page UI requirements

Create one page titled:

"Backend & Database Health Monitor"

The page should contain:

### 1. Backend selection
Allow the user to enter or select a backend API URL.

Provide sample backend configurations for:
- Django + PostgreSQL
- FastAPI + MySQL
- Express.js + MongoDB
- Go + Cassandra
- PHP + SQLite
- Python + Redis + InfluxDB

These should be configurable URLs, not assumed to be running.

### 2. Health check section

Provide three buttons:

- Check API Health
- Check Application Health
- Check Database Health

Call the respective endpoints:

- `/health`
- `/health/app`
- `/health/db`

### 3. Results section

Display:
- Service name
- API status
- Application status
- Database status
- Database type
- HTTP status code
- Response time in milliseconds
- API response JSON

### 4. UI states

Support:
- Healthy
- Unhealthy
- Loading
- Connection failed
- Request timeout
- Invalid API URL

Use clear visual indicators and readable status messages.

### 5. Additional functionality
- Allow users to change the backend URL.
- Add a button to execute all three checks.
- Add a refresh button.
- Do not automatically poll continuously.
- Show the time of the last check.

## Design requirements
- Clean, modern, minimal UI.
- Responsive layout.
- No unnecessary animations.
- No authentication.
- No complex dashboard functionality.
- Keep everything on one page.

## Project requirements
- Use reusable React components where appropriate.
- Keep API request logic separate from UI components.
- Configure backend URLs through an editable UI or environment configuration.
- Handle CORS and network errors properly.
- Do not expose secrets.

## Deliverables
- Complete source code.
- `package.json`
- `.env.example` if needed.
- `.gitignore`
- `README.md`

## Testing
- Test with at least one running backend.
- Test healthy and unhealthy responses.
- Test connection failures.
- Verify that all three endpoints are called correctly.

Build and run the application successfully.