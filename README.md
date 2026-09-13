# NutriTrack — Personal Calorie & Nutrition Tracker

NutriTrack is an intelligent full-stack calorie and macro tracking web application powered by **Google Gemini AI**, backed by **Supabase PostgreSQL (via Prisma ORM)**, accelerated with **Redis Cloud caching**, and integrated with **Cloudinary** for persistent media asset management with **SHA-256 file content deduplication**.

---

## 🏗️ Architecture Overview

The system is designed with a high-performance **cache-aside** and **content-addressed deduplication** pattern:

```text
                               ┌─────────────────────────┐
                               │   React Frontend (Vite) │
                               └────────────┬────────────┘
                                            │ HTTP / JSON & Multipart
                                            ▼
                               ┌─────────────────────────┐
                               │   Express.js Backend    │
                               │   (Node.js + Multer RAM)│
                               └───────┬───────────┬─────┘
                                       │           │
                     ┌─────────────────┴─┐       ┌─┴─────────────────┐
                     │   SHA-256 Hash    │       │ Redis Cloud Cache │
                     │   Calculator      │       │ (Cache-Aside)     │
                     └─────────┬─────────┘       └─┬─────────────────┘
                               │                   │
                 ┌─────────────┴────────┐          │ Fast HIT
                 │ Deduplication Check  ├──────────┘
                 │ (userId + fileHash)  │
                 └─────────────┬────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     [Duplicate HIT]                        [New Upload MISS]
   Same user + same file                 Same/different user + new file
  • Reuse stored Gemini result          1. Stream upload to Cloudinary (secure_url)
  • NO Gemini API call ($0 cost)        2. Call Google Gemini 1.5 Flash Vision / PDF
  • Instant response                    3. Persist record to Supabase (FileUpload)
                                        4. Populate Redis Cloud cache (TTL)
                                        5. Return analyzed nutrition data
```

---

## 🗄️ Database Changes & Migrations

The database is hosted on **Supabase PostgreSQL** and managed through **Prisma ORM**.

### 1. New Model: `FileUpload`

Located in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma):

```prisma
model FileUpload {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  fileHash         String   // SHA-256 hex digest of file contents
  fileType         String   // "image" | "pdf"
  originalName     String?
  cloudinaryUrl    String   // Cloudinary secure_url
  processingStatus String   @default("completed") // "pending" | "completed" | "failed"
  geminiResult     Json?    // Cached structured response from Gemini
  errorMessage     String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([userId, fileHash])
  @@index([userId, fileHash])
}
```

### 2. Running Migrations

You can apply the database changes using either method below:

#### Option A: Prisma CLI (Recommended)
From the `backend` directory:
```bash
npx prisma db push
```

#### Option B: Supabase SQL Editor (Manual SQL)
Open your **Supabase Project Dashboard** → **SQL Editor** → Paste and run:

```sql
-- 1. Create FileUpload table
CREATE TABLE IF NOT EXISTS "FileUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "originalName" TEXT,
    "cloudinaryUrl" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'completed',
    "geminiResult" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- 2. Add foreign key relation
ALTER TABLE "FileUpload" 
ADD CONSTRAINT "FileUpload_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Create unique index for user + fileHash deduplication
CREATE UNIQUE INDEX IF NOT EXISTS "FileUpload_userId_fileHash_key" 
ON "FileUpload"("userId", "fileHash");

CREATE INDEX IF NOT EXISTS "FileUpload_userId_fileHash_idx" 
ON "FileUpload"("userId", "fileHash");
```

---

## 🔐 Environment Variables

The backend configuration is managed through `backend/.env`. A reference template is provided in [`backend/.env.example`](backend/.env.example).

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# ── Supabase PostgreSQL Database (via Prisma) ─────────────────────────────────
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"


# ── Redis Cloud (Direct Connection) ───────────────────────────────────────────
REDIS_URL=redis://default:your_redis_password@your_redis_endpoint.cloud.redislabs.com:12345

# ── Cloudinary (Images & PDFs) ────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ── Google Gemini AI ──────────────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here

# ── JWT Authentication ────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
```

> **Security Note:** `backend/.env` and all `*.env` files are strictly gitignored to prevent credential leaks.

---

## ⚙️ Exact Manual Setup Steps

### 1. Supabase Setup
1. Log in to [Supabase](https://supabase.com) and create or select your project.
2. Under **Project Settings** → **Database**:
   - Copy the **Connection string** (URI) with **Mode: Transaction** (port `6543`) into `DATABASE_URL`.
   - Copy the **Connection string** (URI) with **Mode: Session** (port `5432`) into `DIRECT_URL`.
3. Run `npx prisma db push` inside `backend/` to sync the database schema.

### 2. Redis Cloud Setup
1. Create a free account at [Redis.com (Redis Cloud)](https://redis.io/try-free/).
2. Create a free subscription (Fixed 30MB free tier).
3. Once the database is created, navigate to **Database** → **Configuration**.
4. Look for **General** → **Public endpoint** (e.g. `redis-12345.c10.us-east-1-2.ec2.redns.redis-cloud.com:12345`) and **Security** → **Default user password**.
5. Form your connection string:
   ```text
   redis://default:<PASSWORD>@<PUBLIC_ENDPOINT>
   ```
   (Or `rediss://` if TLS is enabled).
6. Paste into `backend/.env` under `REDIS_URL`.
7. *Note:* The backend is built with connection resilience; if `REDIS_URL` is empty or Redis is temporarily down, the app automatically falls back to Supabase without crashing.

### 3. Cloudinary Setup
1. Sign up at [Cloudinary](https://cloudinary.com/).
2. On your **Cloudinary Dashboard**, locate the **Product Environment Credentials**:
   - `Cloud Name` → `CLOUDINARY_CLOUD_NAME`
   - `API Key` → `CLOUDINARY_API_KEY`
   - `API Secret` → `CLOUDINARY_API_SECRET`
3. Paste these values into `backend/.env`.

### 4. Google Gemini API Setup
1. Navigate to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. Copy the key and paste it into `backend/.env` under `GEMINI_API_KEY`.

---

## 🚀 How to Run the Project

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Start the Backend
```bash
cd backend
npm install
npm run dev
```
- Backend starts at: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
- Frontend starts at: `http://localhost:5173`

---

## 🔍 How SHA-256 Deduplication Works

Every uploaded image or PDF contains a cryptographic digital fingerprint. Rather than hashing metadata or Cloudinary URLs (which can change between uploads), NutriTrack hashes the **exact binary content** of the file in RAM using SHA-256:

```javascript
const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
```

### Composite Key: `user_id + file_hash`
Duplicate detection is scoped strictly per user:

| Scenario | Condition | Result |
|---|---|---|
| **Same User + Same File** | `(user_id, file_hash)` exists | **REUSE** stored Gemini result. **DO NOT** call Gemini API. **NO** redundant Cloudinary upload. Instant response with zero extra API billing. |
| **Different User + Same File** | User B uploads file previously uploaded by User A | **NEW UPLOAD**. User B's own record is created; Gemini can be called and results stored specifically for User B. |
| **Same User + Modified File** | Any 1 byte changed in file | New SHA-256 hash. Treated as a new upload. |

---

## ⚡ How Redis Cloud Caching Works

Redis Cloud is used as a high-performance **cache-aside** layer:

```text
Incoming Request
       │
       ▼
Check Redis Cache
       ├─► [HIT] ────► Return cached JSON immediately (~5ms)
       │
       └─► [MISS] ───► Query Supabase PostgreSQL
                            │
                            ▼
                       Write result into Redis (with TTL)
                            │
                            ▼
                       Return response (~100-250ms)
```

### Key Spaces & TTL Policies

| Key Pattern | Purpose | TTL |
|---|---|---|
| `gemini:file:{userId}:{fileHash}` | Cached Gemini AI analysis for images and PDFs | **30 Days** (`2592000s`) |
| `reports:*:{userId}:{start}:{end}` | Weekly calories, macro breakdown, micros, goal comparison, meal distribution | **30 Minutes** (`1800s`) |
| `entries:today:{userId}:{date}` | Today's food entries and daily totals | **10 Minutes** (`600s`) |
| `goals:active:{userId}` | Current active user nutrition goal | **1 Hour** (`3600s`) |

### Cache Invalidation on Mutation
Whenever an entry is created, updated, deleted, imported from a PDF, or logged by the AI chat, the backend automatically invalidates related cache keys:
```javascript
await invalidateUserCache(userId);
```
This triggers a non-blocking `SCAN` and delete for:
- `entries:*:{userId}*`
- `reports:*:{userId}*`
- `goals:*:{userId}*`

The user always sees immediate updates without stale data!

---

## 🧪 How to Test New Upload vs Duplicate Upload

### Verification via cURL or Frontend

#### 1. Register & Login to get a JWT
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Tester","email":"test@example.com","password":"Password123!"}'

# Login
LOGIN_RES=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}')

TOKEN=$(echo $LOGIN_RES | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "JWT Token: $TOKEN"
```

#### 2. Test 1: Upload New Image
Upload a food image for the first time:
```bash
curl -X POST http://localhost:5000/api/ai/analyze-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/food.jpg"
```
**Expected Response:**
```json
{
  "success": true,
  "data": { "foodName": "Grilled Chicken Salad", "calories": 350, ... },
  "source": "gemini_api",
  "duplicate": false,
  "fileHash": "9f83...64chars",
  "cloudinaryUrl": "https://res.cloudinary.com/.../uploaded-food.jpg"
}
```
*Backend logs:*
```text
☁️ [New File] Uploading image to Cloudinary...
🤖 [New File] Calling Gemini API for image analysis...
✅ [Success] Processed and saved new image
```

#### 3. Test 2: Upload Duplicate Image (Same User)
Upload the exact same `food.jpg` again:
```bash
curl -X POST http://localhost:5000/api/ai/analyze-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/food.jpg"
```
**Expected Response:**
```json
{
  "success": true,
  "data": { "foodName": "Grilled Chicken Salad", "calories": 350, ... },
  "source": "redis_cache",
  "duplicate": true,
  "fileHash": "9f83...64chars"
}
```
*Backend logs:*
```text
⚡ [Cache HIT] Returning cached Gemini analysis for user ... (hash: 9f83...)
```
Notice:
- Response is returned in **< 15 milliseconds**
- **Zero calls** made to Gemini API
- **Zero re-uploads** to Cloudinary

#### 4. Test 3: Upload with Different User
Create a second user account and upload the exact same `food.jpg`.
**Expected Response:**
- `duplicate: false`
- Processed as a new upload for user 2 with isolated records and permissions.

---

## 📡 Complete API Reference

### AI Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/analyze-image` | Upload image (`multipart/form-data`) → SHA-256 check → Cloudinary → Gemini |
| `POST` | `/api/ai/import-pdf` | Upload food diary PDF → SHA-256 check → Cloudinary → Gemini → bulk import |
| `POST` | `/api/ai/chat` | Conversational NutriBot coach with automatic meal logging & cache invalidation |
| `GET` | `/api/ai/chat/history` | Paginated chat message history |
| `DELETE` | `/api/ai/chat/history` | Clear conversational history |

### Food Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/entries` | List entries (paginated, date range & meal filters) |
| `GET` | `/api/entries/today` | Today's entries grouped by meal (Redis cached) |
| `POST` | `/api/entries` | Add meal entry (invalidates cache) |
| `PUT` | `/api/entries/:id` | Update meal entry (invalidates cache) |
| `DELETE` | `/api/entries/:id` | Delete meal entry (invalidates cache) |

### Reports (Redis Cached)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/weekly-calories` | Daily calorie breakdown for date range |
| `GET` | `/api/reports/macros` | Daily protein/carbs/fat totals |
| `GET` | `/api/reports/micros` | Micronutrient aggregate breakdown |
| `GET` | `/api/reports/goal-comparison` | Target vs actual nutritional intake |
| `GET` | `/api/reports/meal-distribution` | Calorie split by meal type |

---

## 📜 License
MIT
