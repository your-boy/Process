# Production Readiness Checklist

## Required backend environment

```dotenv
SPRING_PROFILES_ACTIVE=prod
APP_AUTH_TOKEN_SECRET=<at least 32 random characters>
DIAGRAM_DB_URL=jdbc:mysql://<host>:3306/<database>?useUnicode=true&characterEncoding=utf8&useSSL=true&serverTimezone=Asia/Shanghai
DIAGRAM_DB_USERNAME=<database user>
DIAGRAM_DB_PASSWORD=<strong database password>
APP_DEFAULT_USER_ENABLED=false
APP_CORS_ALLOWED_ORIGINS=https://<your-frontend-host>
APP_TRUST_FORWARDED_HEADERS=true
```

The backend refuses to start under the `prod` profile when the token secret is
missing/default/short, the database password is empty or `root`, or demo-user
bootstrapping is still enabled.

## Frontend

```dotenv
VITE_API_BASE_URL=https://<your-api-host>
```

Serve the built `frontend/dist` bundle over HTTPS. Keep the CSP meta tag in
`index.html`; if a reverse proxy adds headers, keep the stricter equivalent.

## Database

The application uses Flyway versioned migrations:

- `V1` creates the baseline schema on a new database
- `V2` adds the per-user document sequence, backfills existing rows, and creates a unique index
- `V3` adds lightweight list/summary fields and backfills previews without reading the LOB content on every list request
- `V4` adds the denormalized `search_text` index so full-content search does not load the document LOB
- `V5` refreshes legacy preview payloads with the current `pageCount` contract

Migration history is stored in `flyway_schema_history`. The startup database account needs
`ALTER`, `UPDATE`, and `CREATE INDEX` privileges. If production policy forbids application DDL,
run the migrations as a DBA first and set `SPRING_FLYWAY_ENABLED=false`.

Back up the database before deploying a new schema version.

## Operations

- Health check: `GET /actuator/health`
- Use HTTPS end to end.
- Put the API behind a reverse proxy that overwrites `X-Forwarded-For`.
- Do not expose the H2 console in production.
- Restrict database and application ports to the private network.
- Monitor `/actuator/health`, API 5xx rate, login 429 rate and database disk usage.
- Rotate `APP_AUTH_TOKEN_SECRET` only as part of a planned session-invalidating deployment.

## Verification commands

```powershell
cd frontend
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=high

cd ../backend
mvn test
mvn -DskipTests package
```

## Security notes

- The application no longer blocks context menus or developer tools; those were
  not security controls and harmed accessibility and supportability.
- Markdown preview is sanitized with DOMPurify before rendering.
- Tokens are kept in `sessionStorage`, expire after 12 hours and are invalidated
  by logout or password change.
- CORS is an explicit allowlist. Wildcard CORS is not enabled.
- API responses include `nosniff`, `SAMEORIGIN`, `no-referrer`, permissions and
  no-store headers.
