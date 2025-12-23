# Server-side Authentication Enforcement

## Goal
Ensure that all sensitive API endpoints (e.g., `/api/conversations`, `/api/messages`, `/api/users/:role/contacts`, etc.) require a valid token. Unauthenticated (guest) requests should receive a 401 response.

## User Review Required
- Confirm that using a simple Base64 token is acceptable for the prototype. In production we would replace it with JWT.
- Approve the list of routes to protect.

## Proposed Changes
### server.js
- [x] Add `authMiddleware` to the following routes:
  - `GET /api/conversations`
  - `POST /api/messages`
  - `GET /api/users/:role/contacts`
  - `POST /api/messages/read`
  - Any other future routes that modify data.
- [x] Ensure the middleware returns 401 when `Authorization` header is missing or token is invalid.
- [x] Update the login endpoint to return `{ user, token }` (already done).
- [x] Verify that the token is stored in `localStorage` on the client (already done in `Login.tsx`).

## Verification Plan
1. Restart the server.
2. Attempt to access `http://localhost:8080/api/conversations?userId=ent_1` directly in the browser – should receive a 401 error.
3. Use the frontend (which includes the token header) to fetch conversations – should succeed.
4. Run `npm run dev` and verify that the UI shows the login screen when not logged in.
5. Check that protected routes return 401 when `localStorage.removeItem('token')` is called.

## Additional Notes
- For a production-ready solution we would replace the Base64 token with JWT (`jsonwebtoken` library) and add expiration handling.
- Consider adding a refresh token mechanism later.
