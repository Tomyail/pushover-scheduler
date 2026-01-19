#!/bin/bash

# Pushover Scheduler 本地测试脚本

BASE_URL="${BASE_URL:-http://localhost:8787}"

echo "📍 测试地址: $BASE_URL"
echo ""

# 使用 Python 生成时间（跨平台兼容）
get_future_time() {
    local seconds="$1"
    python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) + timedelta(seconds=$seconds)).strftime('%Y-%m-%dT%H:%M:%SZ'))"
}

get_current_time() {
    python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%H:%M:%S'))"
}

# 1. 健康检查
echo "1️⃣  健康检查..."
curl -s "$BASE_URL/health" | jq '.'
echo ""

# 2. 创建一次性任务（当前时间 + 1 分钟）
SCHEDULED_TIME=$(get_future_time 60)
echo "2️⃣  创建一次性任务（$SCHEDULED_TIME）..."
CURRENT_TIME=$(get_current_time)
TASK1_RESPONSE=$(curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"测试一次性任务 - $CURRENT_TIME\",
    \"title\": \"本地测试\",
    \"schedule\": {
      \"type\": \"once\",
      \"datetime\": \"$SCHEDULED_TIME\"
    }
  }")
echo "$TASK1_RESPONSE" | jq '.'
TASK1_ID=$(echo "$TASK1_RESPONSE" | jq -r '.taskId')
echo ""

# 3. 创建重复任务（每 5 分钟一次）
echo "3️⃣  创建重复任务（每 5 分钟）..."
CURRENT_TIME=$(get_current_time)
TASK2_RESPONSE=$(curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"重复任务测试 - $CURRENT_TIME\",
    \"title\": \"5分钟提醒\",
    \"schedule\": {
      \"type\": \"repeat\",
      \"cron\": \"*/5 * * * *\"
    },
    \"pushover\": {
      \"sound\": \"pushover\"
    }
  }")
echo "$TASK2_RESPONSE" | jq '.'
TASK2_ID=$(echo "$TASK2_RESPONSE" | jq -r '.taskId')
echo ""

# 4. 查看所有任务
echo "4️⃣  查看所有任务..."
sleep 1  # 等待任务存储完成
curl -s "$BASE_URL/tasks" | jq '.'
echo ""

# 5. 创建一个即时任务（用于快速测试，30秒后）
echo "5️⃣  创建即时任务（30 秒后）..."
SCHEDULED_TIME_NOW=$(get_future_time 30)
CURRENT_TIME=$(get_current_time)
curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"立即测试 - $CURRENT_TIME\",
    \"title\": \"快速测试\",
    \"schedule\": {
      \"type\": \"once\",
      \"datetime\": \"$SCHEDULED_TIME_NOW\"
    },
    \"pushover\": {
      \"priority\": 1,
      \"sound\": \"siren\"
    }
  }" | jq '.'
echo ""

echo "✅ 测试完成！"
echo ""
echo "📝 创建的任务："
echo "  - 一次性任务: $TASK1_ID"
echo "  - 重复任务: $TASK2_ID"
echo ""
echo "🗑️  删除任务示例:"
echo "  curl -X DELETE $BASE_URL/tasks/$TASK1_ID"
echo ""
echo "📊 查看日志:"
echo "  wrangler tail"
echo ""
echo "⏰  你应该在大约 30 秒后收到第一条通知！"
