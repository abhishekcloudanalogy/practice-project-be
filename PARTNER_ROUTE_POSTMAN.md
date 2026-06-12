# Partner APIs — Postman Testing Guide

Personal guide for testing all partner routes with `protect` + `SUPER_ADMIN` auth in Postman.

**Base URL (local):** `http://localhost:4000`  
All routes are under `/api`.

---

## Auth setup (do this first)

### 1. Login — get token

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/users/login` |
| **Auth** | None |
| **Headers** | `Content-Type: application/json` |

**Body:**

```json
{
  "email": "anmolvishw@maildrop.cc",
  "password": "Anmol@123"
}
```

> Seed super admin: `npx prisma db seed` (see `prisma/seed.js`)

**Response — copy `data.token`:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "role": "SUPER_ADMIN", ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Use token on every partner request

**Authorization tab → Type: Bearer Token → paste token**

Or header manually:

```text
Authorization: Bearer <your_token>
Content-Type: application/json
```

All partner routes below require **`SUPER_ADMIN`** role.

---

## Postman environment (recommended)

| Variable | Value |
|----------|--------|
| `baseUrl` | `http://localhost:4000` |
| `token` | *(set after login)* |
| `partnerId` | `1234` *(example — set from create response)* |

**Login → Tests tab** (auto-save token):

```javascript
const json = pm.response.json();
if (json.data?.token) {
  pm.environment.set("token", json.data.token);
}
```

**Add partner → Tests tab** (auto-save partner id):

```javascript
const json = pm.response.json();
if (json.data?.id) {
  pm.environment.set("partnerId", json.data.id);
}
```

Use `{{token}}` in Authorization and `{{baseUrl}}` in URLs.

---

## All partner routes

| # | Method | URL | Description |
|---|--------|-----|-------------|
| 1 | `POST` | `/api/partners/addpartner` | Create partner |
| 2 | `POST` | `/api/partners/addprogram` | Create program for a partner |
| 3 | `GET` | `/api/partners/names` | List all partner id + names |
| 4 | `GET` | `/api/partners/count` | Total partner count |
| 5 | `GET` | `/api/partners/programs` | Programs by partner id or name |
| 6 | `PATCH` | `/api/partners/:partnerId` | Update partner |
| 7 | `DELETE` | `/api/partners/:partnerId` | Delete partner (+ programs) |

> Partner ids start at **1234** (see migration `partner_id_start_1234`).

---

## 1. Add partner

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/partners/addpartner` |
| **Auth** | Bearer `{{token}}` |

**Body (raw JSON):**

```json
{
  "PartnerName": "Acme Corp",
  "ExternalId": "ext-001",
  "ParentPartner": null,
  "PmId": "pm-123",
  "Url": "https://acme.example.com",
  "Email": "partner@acme.example.com"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `PartnerName` | Yes | Must be unique |
| `ExternalId` | No | |
| `ParentPartner` | No | |
| `PmId` | No | |
| `Url` | No | |
| `Email` | No | |

**Success `201`:**

```json
{
  "success": true,
  "message": "Partner created successfully",
  "data": {
    "id": 1234,
    "externalId": "ext-001",
    "partnerName": "Acme Corp",
    "parentPartner": null,
    "pmId": "pm-123",
    "url": "https://acme.example.com",
    "email": "partner@acme.example.com",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:** `400` duplicate name, `401` no/invalid token, `403` not SUPER_ADMIN

---

## 2. Add program

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{{baseUrl}}/api/partners/addprogram` |
| **Auth** | Bearer `{{token}}` |

**Body — only 3 fields required:**

```json
{
  "partnerName": "Acme Corp",
  "ProgramName": "Gold Rewards",
  "Description": "Premium loyalty program for top customers"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `partnerName` | Yes | Must match existing partner |
| `ProgramName` | Yes | Saved as `partnerProgramName` |
| `Description` | Yes | |

**Success `201`:**

```json
{
  "success": true,
  "message": "Program created successfully",
  "data": {
    "id": 1,
    "partnerProgramName": "Gold Rewards",
    "description": "Premium loyalty program for top customers",
    "verificationStep": false,
    "template": null,
    "loginTemplate": null,
    "loginScript": null,
    "partnerId": 1234,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:** `400` missing field, `404` partner not found

---

## 3. Get all partner names

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/partners/names` |
| **Auth** | Bearer `{{token}}` |
| **Body** | None |

**Success `200`:**

```json
{
  "success": true,
  "message": "Partner names fetched successfully",
  "data": [
    { "id": 1234, "partnerName": "Acme Corp" },
    { "id": 1235, "partnerName": "Beta Inc" }
  ]
}
```

Sorted A→Z by `partnerName`.

---

## 4. Total partner count

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/partners/count` |
| **Auth** | Bearer `{{token}}` |
| **Body** | None |

**Success `200`:**

```json
{
  "success": true,
  "message": "Partner count fetched successfully",
  "data": {
    "total": 5
  }
}
```

---

## 5. Get partner programs (by id or name)

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `{{baseUrl}}/api/partners/programs` |
| **Auth** | Bearer `{{token}}` |

**Query params** (at least one required):

| Param | Example | Notes |
|-------|---------|-------|
| `partnerId` | `?partnerId=1234` | Numeric id |
| `partnerName` | `?partnerName=Acme Corp` | Exact name match |
| Both | `?partnerId=1234&partnerName=Acme Corp` | Must match same partner |

**Postman — Params tab:**

| Key | Value |
|-----|--------|
| `partnerId` | `{{partnerId}}` |

or

| Key | Value |
|-----|--------|
| `partnerName` | `Acme Corp` |

**Success `200`:**

```json
{
  "success": true,
  "message": "Partner programs fetched successfully",
  "data": {
    "partner": {
      "id": 1234,
      "partnerName": "Acme Corp"
    },
    "total": 2,
    "programs": [
      {
        "id": 1,
        "partnerProgramName": "Gold Rewards",
        "description": "Premium loyalty program",
        "verificationStep": false,
        "template": null,
        "loginTemplate": null,
        "loginScript": null,
        "partnerId": 1234,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

**Errors:** `400` missing query / id-name mismatch, `404` partner not found

---

## 6. Update partner

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `{{baseUrl}}/api/partners/{{partnerId}}` |
| **Auth** | Bearer `{{token}}` |

Send **only fields you want to change** (at least one required):

```json
{
  "PartnerName": "Acme Updated",
  "Email": "new@acme.example.com",
  "Url": "https://new-acme.example.com"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `PartnerName` | No | Cannot be empty if sent; must stay unique |
| `ExternalId` | No | |
| `ParentPartner` | No | |
| `PmId` | No | |
| `Url` | No | |
| `Email` | No | |

**Success `200`:**

```json
{
  "success": true,
  "message": "Partner updated successfully",
  "data": {
    "id": 1234,
    "partnerName": "Acme Updated",
    ...
  }
}
```

**Errors:** `400` empty body / invalid id / duplicate name, `404` partner not found

---

## 7. Delete partner

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `{{baseUrl}}/api/partners/{{partnerId}}` |
| **Auth** | Bearer `{{token}}` |
| **Body** | None |

**Success `200`:**

```json
{
  "success": true,
  "message": "Partner deleted successfully",
  "data": {
    "id": 1234,
    "partnerName": "Acme Corp",
    ...
  }
}
```

> All linked programs are deleted automatically (cascade).

**Errors:** `400` invalid id, `404` partner not found

---

## Suggested test order in Postman

```text
1. POST  /api/users/login              → save token
2. POST  /api/partners/addpartner      → save partnerId (e.g. 1234)
3. GET   /api/partners/names           → verify name in list
4. GET   /api/partners/count           → verify total increased
5. POST  /api/partners/addprogram      → create program for partner
6. GET   /api/partners/programs?partnerId=1234  → see programs + total
7. PATCH /api/partners/1234            → update email/url
8. DELETE /api/partners/1234           → remove partner (optional)
```

---

## Common errors

| Status | Message | Fix |
|--------|---------|-----|
| `401` | `Unauthorized` | Add `Authorization: Bearer <token>` header |
| `401` | `Invalid token` | Login again — token expired or wrong secret |
| `403` | `Forbidden` | User must be `SUPER_ADMIN` |
| `400` | `Partner with this name already exists` | Use a different `PartnerName` |
| `400` | `partnerId or partnerName is required` | Add query param on `/programs` |
| `400` | `At least one field is required to update` | Send at least one field in PATCH body |
| `400` | `Invalid email address` | Fix `Email` on create/update |
| `400` | `Invalid partner id` | Use a positive integer (e.g. `1234`) |
| `404` | `Partner not found` | Check id/name exists |

---

## Project structure (same pattern as users route)

```text
src/routes/
├── partner.routes.js              ← route wiring + auth + validation middleware
└── partner/
    ├── partner.controller.js      ← HTTP handlers (thin — no inline field checks)
    ├── partner.validation.js      ← Zod schemas (body + query + param id)
    └── helper.js                  ← Prisma DB functions only
```

Compare with users:

```text
src/routes/
├── user.routes.js
└── user/
    ├── user.controller.js
    ├── user.validation.js
    └── helper.js
```

---

## Middleware chain (all partner routes)

```text
protect                    → validates Bearer JWT
authorize("SUPER_ADMIN")
validate* (where needed)   → Zod body / query / param checks
controller                 → business logic + ApiResponse
helper                     → Prisma queries
```

| Route | Validation middleware |
|-------|----------------------|
| `POST /addpartner` | `validateAddPartner` |
| `POST /addprogram` | `validateAddProgram` |
| `GET /programs` | `validatePartnerProgramsQuery` |
| `PATCH /:partnerId` | `validatePartnerIdParam` + `validateUpdatePartner` |
| `DELETE /:partnerId` | `validatePartnerIdParam` |
| `GET /names`, `GET /count` | none (no input) |

**Source files:**

- `src/routes/partner.routes.js`
- `src/routes/partner/partner.controller.js`
- `src/routes/partner/partner.validation.js`
- `src/routes/partner/helper.js`
- `src/middlewares/auth.middleware.js`

---

## Notes

- Request body for **partner** create/update uses **PascalCase** (`PartnerName`, `ExternalId`, …). Validation maps these to camelCase before saving.
- Request body for **add program** uses `partnerName` (camelCase) + `ProgramName` + `Description`.
- API responses use **camelCase** (`partnerName`, `partnerProgramName`, …).
- Partner ids start at **1234** (PostgreSQL sequence migration).
- Delete partner also deletes all linked programs (cascade).
- Health check (no auth): `GET {{baseUrl}}/api/health`
