#!/bin/bash

WORKER_URL="https://pushover-scheduler.tomyail.workers.dev"

echo "🔍 诊断生产环境问题"
echo ""

echo "1️⃣  创建任务..."
SCHEDULED_TIME=$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) + timedelta(seconds=30)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
echo "   计划时间: $SCHEDULED_TIME"

RESPONSE=$(curl -s -X POST $WORKER_URL/schedule \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"诊断测试\",\"title\":\"测试\",\"schedule\":{\"type\":\"once\",\"datetime\":\"$SCHEDULED_TIME\"}}")

echo "   响应: $RESPONSE"
TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "   任务 ID: $TASK_ID"
echo ""

echo "2️⃣  立即查询任务列表..."
curl -s $WORKER_URL/tasks | jq '.'
echo ""

echo "3️⃣  等待任务执行..."
sleep 35

echo "4️⃣  再次查询任务列表（应该为空，任务已执行并删除）..."
curl -s $WORKER_URL/tasks | jq '.'
echo ""

echo "✅ 诊断完成！"
echo ""
echo "如果你在计划时间左右收到了 Pushover 通知，说明服务正常。"
echo "如果没有收到，请检查："
echo "  1. Secrets 是否正确设置"
echo "  2. 运行: npx wrangler tail pushover-scheduler"
echo "  3. 查看 Pushover 网站的消息日志"
