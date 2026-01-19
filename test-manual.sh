#!/bin/bash

# 手动触发 alarm 测试脚本

BASE_URL="${BASE_URL:-http://localhost:8787}"

echo "🔧 手动触发 Alarm 测试"
echo ""

# 1. 查看当前任务
echo "1️⃣  查看当前任务..."
TASKS_RESPONSE=$(curl -s "$BASE_URL/tasks")
echo "$TASKS_RESPONSE" | jq '.'
echo ""

# 2. 创建一个立即执行的任务（时间设为过去）
echo "2️⃣  创建一个应该立即执行的任务..."
PAST_TIME=$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) - timedelta(seconds=60)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"立即执行的任务 - $(python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%H:%M:%S'))")\",
    \"title\": \"手动触发测试\",
    \"schedule\": {
      \"type\": \"once\",
      \"datetime\": \"$PAST_TIME\"
    }
  }" | jq '.'
echo ""

# 3. 再次查看任务
echo "3️⃣  再次查看所有任务..."
sleep 1
curl -s "$BASE_URL/tasks" | jq '.'
echo ""

# 4. 手动触发 alarm
echo "4️⃣  手动触发 alarm（执行所有到期任务）..."
echo "   这将发送 Pushover 通知！"
echo ""
read -p "按 Enter 继续触发 alarm..."
TRIGGER_RESPONSE=$(curl -s -X POST "$BASE_URL/trigger-alarm")
echo "$TRIGGER_RESPONSE" | jq '.'
echo ""

# 5. 查看剩余任务
echo "5️⃣  查看剩余任务（一次性任务应该已被删除）..."
curl -s "$BASE_URL/tasks" | jq '.'
echo ""

echo "✅ 测试完成！"
echo ""
echo "📱 检查你的手机，应该收到 Pushover 通知了！"
echo ""
echo "📊 如果没有收到通知，检查："
echo "   1. .dev.vars 中的密钥是否正确"
echo "   2. 开发服务器终端的错误日志"
echo "   3. Pushover 网站的消息日志"
