# Pushover Scheduler

部署在 Cloudflare Worker 的定时 Pushover 通知服务。

## 功能特性

- 支持一次性定时任务
- 支持重复任务（Cron 表达式）
- 完全自定义 Pushover 参数
- 基于 Durable Objects 的持久化存储
- 精确的 Alarm 调度

## 前置要求

- Cloudflare 账户
- Node.js 18+
- Wrangler CLI
- Pushover 账户（获取 User Key 和 API Token）

## 安装部署

### 1. 安装依赖

```bash
cd pushover-scheduler
npm install
```

### 2. 配置环境变量

**本地开发：** 创建 `.dev.vars` 文件

```bash
PUSHOVER_USER_KEY=your_user_key
PUSHOVER_API_TOKEN=your_api_token
```

**生产部署：** 设置 Cloudflare Secrets

```bash
npx wrangler secret put PUSHOVER_USER_KEY
npx wrangler secret put PUSHOVER_API_TOKEN
```

📖 **详细部署步骤请查看：[DEPLOY.md](DEPLOY.md)**

### 3. 部署

```bash
npm run deploy
```

✅ 部署成功后，你会看到类似输出：
```
Published pushover-scheduler
  https://pushover-scheduler.YOUR_SUBDOMAIN.workers.dev
```

## API 使用

### 健康检查

```bash
curl https://your-worker.workers.dev/health
```

### 创建一次性任务

```bash
curl -X POST https://your-worker.workers.dev/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "message": "会议提醒",
    "title": "重要会议",
    "schedule": {
      "type": "once",
      "datetime": "2025-01-20T10:00:00Z"
    }
  }'
```

### 创建重复任务

```bash
# 每天早上 9 点
curl -X POST https://your-worker.workers.dev/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "message": "每日提醒",
    "title": "早上好",
    "schedule": {
      "type": "repeat",
      "cron": "0 9 * * *"
    }
  }'

# 每周一上午 10 点
curl -X POST https://your-worker.workers.dev/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "message": "周会提醒",
    "title": "周例会",
    "schedule": {
      "type": "repeat",
      "cron": "0 10 * * 1"
    }
  }'
```

### 自定义 Pushover 参数

```bash
curl -X POST https://your-worker.workers.dev/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "message": "紧急通知",
    "title": "高优先级",
    "schedule": {
      "type": "once",
      "datetime": "2025-01-20T10:00:00Z"
    },
    "pushover": {
      "priority": 1,
      "sound": "siren",
      "device": "iphone",
      "url": "https://example.com",
      "url_title": "查看详情"
    }
  }'
```

### 查看所有任务

```bash
curl https://your-worker.workers.dev/tasks
```

### 删除任务

```bash
curl -X DELETE https://your-worker.workers.dev/tasks/{taskId}
```

## 请求格式

### 请求体

```typescript
{
  message: string;           // 必需：通知内容
  title?: string;            // 可选：通知标题
  schedule: {
    type: 'once' | 'repeat'; // 任务类型
    datetime?: string;       // 一次性任务的 ISO 时间
    cron?: string;           // 重复任务的 cron 表达式
  };
  pushover?: {
    priority?: number;       // 优先级：-2 到 2
    sound?: string;          // 提示音
    device?: string;         // 目标设备
    url?: string;            // 附加链接
    url_title?: string;      // 链接标题
    html?: number;           // 启用 HTML：1 或 0
  };
}
```

### Cron 表达式

格式：`分 时 日 月 周`

```
0 9 * * *        # 每天早上 9 点
0 */6 * * *      # 每 6 小时
0 10 * * 1       # 每周一上午 10 点
*/30 * * * *     # 每 30 分钟
0 0 1 * *        # 每月 1 号午夜
```

## 本地开发

```bash
# 启动开发服务器
npm run dev

# 查看实时日志
npm run tail
```

## 项目结构

```
pushover-scheduler/
├── src/
│   ├── index.ts      # 主 Worker 入口
│   ├── scheduler.ts  # Durable Object 调度器
│   ├── pushover.ts   # Pushover API 客户端
│   └── types.ts      # TypeScript 类型定义
├── wrangler.toml     # Cloudflare Worker 配置
├── package.json
└── README.md
```

## 参考资料

- [Pushover API](https://pushover.net/api)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
