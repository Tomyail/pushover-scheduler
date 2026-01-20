# Pushover Scheduler

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Tomyail/pushover-scheduler)

A professional, scheduled notification service built on **Cloudflare Workers**, **Durable Objects**, and **Hono**, featuring a modern **React** frontend.

## 🚀 Overview

Pushover Scheduler allows you to schedule one-time or recurring notifications via Pushover with precision. Leveraging Cloudflare's edge infrastructure, it ensures high availability and low-latency task execution.

### Architecture
- **Monorepo Structure**: 
  - `server/`: Hono-powered API gateway and Durable Object scheduler.
  - `web/`: React frontend built with Vite and Tailwind CSS.
  - `wrangler.toml`, `.dev.vars.example`: Configuration files located in the project root.
- **Durable Objects with SQLite**: Leverages Cloudflare's Durable Objects with built-in SQLite storage for high-precision alarms and persistent task management.
- **Authentication**: Secure HMAC-SHA256 JWT-based authentication using `AUTH_PASSWORD`.
- **Routing**: Lightweight and fast routing via Hono framework.

## 🛠 Setup & Installation

### Prerequisites
- A [Cloudflare](https://dash.cloudflare.com/) account.
- [pnpm](https://pnpm.io/) installed locally.

### 1. Clone the repository
```bash
git clone https://github.com/Tomyail/pushover-scheduler.git
cd pushover-scheduler
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Configure environment variables
Create a `.dev.vars` file in the project root for local development:
```env
AUTH_PASSWORD=your_secure_password
PUSHOVER_USER_KEY=your_pushover_user_key
PUSHOVER_API_TOKEN=your_pushover_api_token
```

For production, you can set these secrets via Wrangler:
```bash
npx wrangler secret put AUTH_PASSWORD
npx wrangler secret put PUSHOVER_USER_KEY
npx wrangler secret put PUSHOVER_API_TOKEN
```

### 4. Run locally
Start both the frontend and backend in development mode:
```bash
npm run dev
```
- **Web**: [http://localhost:5173](http://localhost:5173)
- **API**: [http://localhost:8787](http://localhost:8787)

### 5. Deployment

#### Deploy via Button
Click the "Deploy to Workers" button at the top of this README. During the deployment process, you will be prompted to enter the following environment variables directly in the Cloudflare dashboard:
- `AUTH_PASSWORD`
- `PUSHOVER_USER_KEY`
- `PUSHOVER_API_TOKEN`

#### Manual Deployment
Build the frontend and deploy the worker to Cloudflare:
```bash
npm run deploy
```

## 🔌 API Usage

You can interact with the scheduler directly via the API. All endpoints (except `/api/login` and `/api/health`) require a Bearer token.

### Get Authentication Token
```bash
curl -X POST https://your-worker.workers.dev/api/login \
  -H "Content-Type: application/json" \
  -d '{"password": "your_secure_password"}'
```
*The response will include a `token` which you should use in subsequent requests.*

### Schedule a Notification
```bash
curl -X POST https://your-worker.workers.dev/api/schedule \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Meeting Reminder",
    "title": "Important",
    "schedule": {
      "type": "once",
      "datetime": "2025-01-20T10:00:00Z"
    },
    "pushover": {
      "priority": 1,
      "sound": "siren"
    }
  }'
```

### Create a Recurring Task (Cron)
```bash
curl -X POST https://your-worker.workers.dev/api/schedule \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Daily Health Check",
    "schedule": {
      "type": "repeat",
      "cron": "0 9 * * *"
    }
  }'
```

### Request Format
```typescript
{
  message: string;           // Required: Notification content
  title?: string;            // Optional: Notification title
  schedule: {
    type: 'once' | 'repeat'; // 'once' or 'repeat'
    datetime?: string;       // ISO 8601 for one-time tasks
    cron?: string;           // Cron expression for recurring tasks
  };
  pushover?: {
    priority?: number;       // -2 to 2
    sound?: string;          // Pushover sound name
    device?: string;         // Target device
    url?: string;            // Attached URL
    url_title?: string;      // URL title
    html?: number;           // Enable HTML: 1 or 0
  };
}
```

## 📄 License
MIT
