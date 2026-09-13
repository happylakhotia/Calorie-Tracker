# NutriTrack — Personal Calorie & Nutrition Tracker

NutriTrack is an intelligent, full-stack personal nutrition and calorie tracking platform. Powered by **Google Gemini AI**, backed by **Supabase PostgreSQL (via Prisma ORM)**, accelerated with **Redis Cloud caching**, and integrated with **Cloudinary** for media management with **SHA-256 file content deduplication**.

---

## 📑 Table of Contents
- [✨ Features](#-features)
  - [Core Tracking & Health Goals](#core-tracking--health-goals)
  - [Interactive Habit Loop & Time Travel](#interactive-habit-loop--time-travel)
  - [Visual Reports & Analytics](#visual-reports--analytics)
  - [AI-Powered Capabilities](#ai-powered-capabilities)
  - [Enterprise-Grade Security & Multi-Tenancy](#enterprise-grade-security--multi-tenancy)
- [📐 System Architecture](#-system-architecture)
- [🗄️ Database Schema & Entity Diagrams](#️-database-schema--entity-diagrams)
- [⚡ SHA-256 Deduplication & Redis Cache-Aside](#-sha-256-deduplication--redis-cache-aside)
- [📡 API Specifications & Pagination](#-api-specifications--pagination)
- [🔐 Environment Variables](#-environment-variables)
- [⚙️ Setup & Installation](#️-setup--installation)
- [🧪 Testing Deduplication & Caching](#-testing-deduplication--caching)
- [📜 License](#-license)

---

## ✨ Features

### Core Tracking & Health Goals
- **Personal Health Goals**: Set daily calorie targets, macronutrient goals (protein, carbs, and fat in grams), target body weight (kg), target completion date, and coaching notes.
- **Structured Meal Logging**: Food entries organized across four distinct daily meal slots: **Breakfast**, **Lunch**, **Dinner**, and **Snacks**.
- **Comprehensive Nutritional Metrics**:
  - **Macronutrients**: Calories, Protein, Carbohydrates, Fat.
  - **Micronutrients**: Dietary Fiber, Sugar, Sodium, Potassium, Vitamin C, Vitamin D, Calcium, and Iron.
- **Hydration Tracker**: Interactive 8-glass water tracker (250ml per glass / 2000ml goal) tracked per calendar date.
- **Weight Progress**: Log current weight updates with immediate trajectory comparison against your target weight goal.

### Interactive Habit Loop & Time Travel
- **7-Day Consistency Track**: Weekly habit loop showing Monday through Sunday consistency at a glance.
- **Interactive Day Selection**: Click on any day box (**Mon, Tue, Wed, Thu, Fri, Sat, Sun**) in the Habit Loop to instantly inspect that specific day's calorie ring, macros, and logged meals.
- **Dynamic Context Switching**: Energy cards, macro bars, and meal cards adapt to the selected day with a 1-click **"Today ↩"** reset button.
- **Date-Aware Meal Entry**: Adding or editing a meal while viewing a past date automatically pre-fills that specific day.

### Visual Reports & Analytics
- **Weekly Calorie Trend**: Bar and area charts displaying daily calorie consumption vs. daily goal over custom time horizons.
- **Macronutrient Breakdown**: Multi-bar and stacked graphs tracking protein, carbohydrate, and fat intake by day and week.
- **Micronutrient Summary**: Aggregated intake totals compared against Recommended Daily Values (RDVs).
- **Goal vs. Actual Comparison**: Day-by-day variance charts highlighting calorie deficits and surpluses.
- **Meal Distribution**: Calorie split and percentage breakdown across breakfast, lunch, dinner, and snacks.
- **PDF Report Export**: Generate and download comprehensive nutrition summary reports directly to PDF using `jspdf` and `html2canvas`.

### AI-Powered Capabilities
- **AI Food Recognition (Vision)**: Upload a photo of a meal plate or a nutrition facts label. Google Gemini 1.5 Flash extracts nutritional values (calories, macros, micros, confidence score) and pre-fills the logging modal.
- **NutriBot Conversational Coach**: Embedded LLM chat assistant that understands natural language. Can answer nutritional questions, evaluate progress, and automatically execute meal log actions (`ACTION:LOG_ENTRY`) into the database.
- **Bulk Diary Import via PDF**: Upload exported food diary PDFs. The backend extracts text using `pdf-parse`, parses tabular entries with Gemini, and bulk-inserts them into your database.

### Enterprise-Grade Security & Multi-Tenancy
- **Multi-User Isolation**: Complete data segregation. All database queries, caches, and uploaded assets are strictly scoped to the authenticated user ID.
- **Robust JWT Authentication**: Access tokens (15-minute lifetime) paired with cryptographically secure refresh tokens stored in PostgreSQL with automatic rotation.
- **Password Security**: Passwords hashed with `bcryptjs` (salt rounds: 12).
- **Graceful Fault Tolerance**: Built-in fallback mechanisms so the application remains responsive even if Redis Cloud or Cloudinary experiences intermittent connectivity.

---

## 📐 System Architecture

NutriTrack enforces a strict separation between client, server, cache, database, and third-party AI services:

```mermaid
flowchart TD
    Client["React 19 Frontend (Vite)"]
    API["Express.js REST API (Node 22)"]
    Redis[("Redis Cloud (Cache-Aside)")]
    DB[("Supabase PostgreSQL (Prisma ORM)")]
    Cloudinary["Cloudinary CDN (Media & PDFs)"]
    Gemini["Google Gemini 1.5 Flash (AI Vision & LLM)"]

    Client -->|HTTP / JSON & Multipart| API
    API <-->|Read / Write Cache (TTL)| Redis
    API <-->|Prisma ORM Client| DB
    API -->|Stream Upload (RAM Buffer)| Cloudinary
    API -->|Base64 Image / Text Analysis| Gemini
```

---

## 🗄️ Database Schema & Entity Diagrams

The database schema is defined in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) and hosted on **Supabase PostgreSQL**.

### Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    User ||--o{ RefreshToken : "has many"
    User ||--o{ FoodEntry : "logs"
    User ||--o{ Goal : "sets"
    User ||--o{ ChatMessage : "exchanges"
    User ||--o{ FileUpload : "uploads"

    User {
        String id PK "UUID"
        String name
        String email UK
        String passwordHash
        DateTime createdAt
        DateTime updatedAt
    }

    RefreshToken {
        String id PK "UUID"
        String token UK
        String userId FK
        DateTime expiresAt
        DateTime createdAt
    }

    FoodEntry {
        String id PK "UUID"
        String userId FK
        String date "YYYY-MM-DD"
        MealType mealType "breakfast | lunch | dinner | snacks"
        String foodName
        Float quantity
        String unit "default: g"
        Float calories
        Float protein
        Float carbs
        Float fat
        Float fiber
        Float sugar
        Float sodium
        Float potassium
        Float vitaminC
        Float vitaminD
        Float calcium
        Float iron
        String imageUrl
        EntrySource source "manual | ai | pdf"
        String notes
        DateTime createdAt
        DateTime updatedAt
    }

    Goal {
        String id PK "UUID"
        String userId FK
        Float dailyCalories
        Float proteinG
        Float carbsG
        Float fatG
        Float weightGoalKg
        DateTime targetDate
        String notes
        DateTime createdAt
        DateTime updatedAt
    }

    ChatMessage {
        String id PK "UUID"
        String userId FK
        ChatRole role "user | assistant"
        String content
        Json actions
        DateTime createdAt
        DateTime updatedAt
    }

    FileUpload {
        String id PK "UUID"
        String userId FK
        String fileHash "SHA-256 Digest"
        String fileType "image | pdf"
        String originalName
        String cloudinaryUrl
        String processingStatus "completed | pending | failed"
        Json geminiResult
        String errorMessage
        DateTime createdAt
        DateTime updatedAt
    }
```

### Key Data Model Choices
1. **ISO Date Strings (`YYYY-MM-DD`)**: Storing `date` as a calendar string prevents timezone shifts and daylight saving errors during date filtering and aggregation.
2. **Compound Unique Index `(userId, fileHash)`**: Enforces cryptographic file deduplication at the PostgreSQL engine level.
3. **Cascade Deletions (`onDelete: Cascade`)**: Deleting a user cleanly purges all related entries, goals, files, and chat messages.
4. **Prisma Session & Transaction Pooling**: Configured for Supabase's transaction pooler (`port 6543`) during runtime and direct connection (`port 5432`) during migrations.

---

## ⚡ SHA-256 Deduplication & Redis Cache-Aside

To eliminate duplicate processing fees and unnecessary Gemini API calls, uploaded media passes through content-addressed deduplication:

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Server as Express Backend
    participant Redis as Redis Cloud
    participant DB as Supabase DB
    participant Cloud as Cloudinary
    participant AI as Gemini AI

    User->>Server: Upload Photo / PDF (Multipart)
    Server->>Server: Calculate SHA-256 of file buffer
    Server->>Redis: Check cache key: gemini:file:{userId}:{fileHash}

    alt Redis Cache HIT
        Redis-->>Server: Return cached nutrition JSON
        Server-->>User: ⚡ Instant Response (source: redis_cache, $0 AI cost)
    else Redis Cache MISS
        Server->>DB: Check FileUpload table: (userId, fileHash)
        alt Database HIT (Duplicate)
            DB-->>Server: Return stored geminiResult & cloudinaryUrl
            Server->>Redis: Store in Redis (TTL: 30 days)
            Server-->>User: 💾 Fast Response (source: database_dedup, $0 AI cost)
        else Database MISS (New File)
            Server->>Cloud: Stream file buffer (upload_stream)
            Cloud-->>Server: Return secure_url
            Server->>AI: Call Gemini Vision / Document Parser
            AI-->>Server: Structured nutritional JSON
            Server->>DB: Insert into FileUpload (userId, fileHash, secure_url, result)
            Server->>Redis: Cache result (TTL: 30 days)
            Server-->>User: ✅ Full Response (source: gemini_api)
        end
    end
```

### Redis Key Patterns & Expiry (TTL) Policies

| Key Pattern | Purpose | TTL | Invalidation Trigger |
|---|---|---|---|
| `gemini:file:{userId}:{fileHash}` | Cached Gemini AI nutrition analysis | **30 Days** (`2592000s`) | Replaced if re-processed |
| `entries:date:{userId}:{YYYY-MM-DD}` | Grouped meal breakdown & daily totals | **10 Minutes** (`600s`) | Any meal logged/edited/deleted |
| `reports:*:{userId}:{start}:{end}` | Aggregated daily totals, macro/micro sums | **30 Minutes** (`1800s`) | Any meal logged/edited/deleted |
| `goals:active:{userId}` | Current active user calorie & macro target | **1 Hour** (`3600s`) | Any goal created/updated/deleted |

---

## 📡 API Specifications & Pagination

All endpoints communicate over JSON with standard HTTP status codes. List endpoints support uniform pagination parameters.

### Standard Pagination Response Schema
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 128,
    "page": 1,
    "limit": 20,
    "totalPages": 7,
    "hasPrev": false,
    "hasNext": true
  }
}
```

### Endpoint Reference

#### Authentication
| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Login and receive access + refresh token | No |
| `POST` | `/api/auth/refresh` | Exchange refresh token for new access token | No |
| `POST` | `/api/auth/logout` | Revoke refresh token and terminate session | Yes |
| `GET` | `/api/auth/me` | Get profile of currently authenticated user | Yes |

#### Meal Entries
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/api/entries` | List entries (paginated) | `startDate`, `endDate`, `date`, `mealType`, `page`, `limit` |
| `GET` | `/api/entries/today` | Get meals & totals for a specific date (Redis cached) | `date` (default: today) |
| `GET` | `/api/entries/:id` | Get single food entry details | — |
| `POST` | `/api/entries` | Log a new food entry (invalidates cache) | — |
| `PUT` | `/api/entries/:id` | Update an existing food entry | — |
| `DELETE` | `/api/entries/:id` | Delete a food entry | — |

#### Goals
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/goals` | Get current active nutrition and weight goal |
| `POST` | `/api/goals` | Create a new goal (becomes active, invalidates cache) |
| `GET` | `/api/goals/history` | Paginated history of previous goals |
| `PUT` | `/api/goals/:id` | Update an existing goal |
| `DELETE` | `/api/goals/:id` | Delete a goal |

#### Reports & Visualizations (Redis Cached)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/api/reports/weekly-calories` | Daily calorie breakdown & entry counts | `startDate`, `endDate` |
| `GET` | `/api/reports/macros` | Daily protein, carb, fat, and calorie totals | `startDate`, `endDate` |
| `GET` | `/api/reports/micros` | Aggregated micronutrient sums & days tracked | `startDate`, `endDate` |
| `GET` | `/api/reports/goal-comparison` | Actual intake vs. goal target comparison | `startDate`, `endDate` |
| `GET` | `/api/reports/meal-distribution` | Calorie split grouped by meal type | `startDate`, `endDate` |

#### AI & File Processing
| Method | Endpoint | Description | Content-Type |
|---|---|---|---|
| `POST` | `/api/ai/analyze-image` | Upload food photo → SHA-256 → Cloudinary → Gemini | `multipart/form-data` |
| `POST` | `/api/ai/import-pdf` | Upload nutrition PDF → SHA-256 → Bulk import | `multipart/form-data` |
| `POST` | `/api/ai/chat` | Conversational NutriBot coach turn | `application/json` |
| `GET` | `/api/ai/chat/history` | Paginated conversational history | — |
| `DELETE` | `/api/ai/chat/history` | Clear conversational history | — |

---

## 🔐 Environment Variables

Configure `backend/.env` according to the template in [`backend/.env.example`](backend/.env.example):

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# ── Database (Supabase PostgreSQL via Prisma) ─────────────────────────────────
# Port 6543 (Transaction mode pooler for app runtime)
DATABASE_URL="postgresql://postgres.[YOUR-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Port 5432 (Session mode for Prisma CLI migrations)
DIRECT_URL="postgresql://postgres.[YOUR-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# ── Redis Cloud (Direct Connection) ───────────────────────────────────────────
REDIS_URL="redis://default:[PASSWORD]@[HOST]:[PORT]"

# ── Cloudinary (Images & PDFs) ────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── Google Gemini AI ──────────────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key

# ── JWT Authentication ────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- Free account credentials for **Supabase**, **Redis Cloud**, **Cloudinary**, and **Google AI Studio**.

### 1. Database Synchronization (Prisma)
From the `backend` directory:
```bash
cd backend
npm install
npx prisma db push
```
*(Prisma connects directly using your `DIRECT_URL` and ensures all tables, foreign keys, and indexes are created).*

### 2. Start Backend Server
```bash
npm run dev
```
- Backend runs at: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

### 3. Start Frontend Client
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Frontend client runs at: `http://localhost:5173`

---

## 🧪 Testing Deduplication & Caching

### 1. Authenticate via cURL
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Tester","email":"test@example.com","password":"Password123!"}'

# Login and extract token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
```

### 2. Test 1: Upload New Image
```bash
curl -X POST http://localhost:5000/api/ai/analyze-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/food.jpg"
```
**Output:**
```json
{
  "success": true,
  "data": { "foodName": "Oatmeal with Berries", "calories": 240, ... },
  "source": "gemini_api",
  "duplicate": false,
  "cloudinaryUrl": "https://res.cloudinary.com/.../uploaded-image.jpg"
}
```

### 3. Test 2: Upload Duplicate Image (Same User)
Upload the exact same `food.jpg`:
```bash
curl -X POST http://localhost:5000/api/ai/analyze-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/path/to/food.jpg"
```
**Output (< 15ms response time, zero Gemini API calls):**
```json
{
  "success": true,
  "data": { "foodName": "Oatmeal with Berries", "calories": 240, ... },
  "source": "redis_cache",
  "duplicate": true
}
```

---

## 📜 License

MIT License. Designed and engineered for high-performance, personalized health tracking.
