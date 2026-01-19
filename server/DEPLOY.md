# 部署到 Cloudflare Workers

## 前置准备

1. 确保已登录 Cloudflare
   ```bash
   npx wrangler login
   ```

2. 准备好 Pushover 密钥
   - User Key: https://pushover.net/
   - API Token: https://pushover.net/apps/build

## 部署步骤

### 1. 设置密钥（Secrets）

```bash
# 设置 Pushover User Key
npx wrangler secret put PUSHOVER_USER_KEY
# 输入你的 user key 后按 Enter

# 设置 Pushover API Token
npx wrangler secret put PUSHOVER_API_TOKEN
# 输入你的 api token 后按 Enter
```

### 2. 部署

```bash
npm run deploy
```

成功后会看到：
```
Published pushover-scheduler
  https://pushover-scheduler.YOUR_SUBDOMAIN.workers.dev
```

### 3. 测试

```bash
# 健康检查
curl https://pushover-scheduler.YOUR_SUBDOMAIN.workers.dev/health

# 创建一个测试任务
curl -X POST https://pushover-scheduler.YOUR_SUBDOMAIN.workers.dev/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "message": "生产环境测试",
    "title": "测试通知",
    "schedule": {
      "type": "once",
      "datetime": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ" -d "+1 minute")'"
    }
  }'
```

### 4. 查看日志

```bash
npm run tail
```

## 管理任务

```bash
# 查看所有任务
curl https://pushover-scheduler.YOUR_SUBDOMAIN.workers.dev/tasks

# 删除任务
curl -X DELETE https://pushover-scheduler.YOUR_SUBDOMAIN.workers.dev/tasks/{任务ID}
```

## 更新密钥

如果需要更新 Pushover 密钥：

```bash
# 重新设置 secret（会覆盖旧值）
npx wrangler secret put PUSHOVER_USER_KEY
npx wrangler secret put PUSHOVER_API_TOKEN

# 重新部署
npm run deploy
```

## 注意事项

- ⚠️ **免费计划的限制**：
  - 每天 100,000 次 Worker 请求
  - Durable Objects 存储：5GB
  - Alarm 调度在生产环境会自动触发

- 🔒 **密钥安全**：
  - 不要将密钥提交到 git
  - 使用 `wrangler secret` 而不是环境变量
  - 定期更换 API Token

## 常见问题

**Q: 部署后 404 错误**
```bash
# 检查 worker 是否正常部署
npx wrangler deployments list
```

**Q: Alarm 没有触发**
- 生产环境会自动触发，不需要手动调用
- 检查任务时间是否正确（UTC 时间）

**Q: 收不到通知**
- 检查 secrets 是否正确设置：`npx wrangler secret list`
- 查看 Pushover 网站的消息日志
- 检查 Worker 日志：`npm run tail`
