#!/bin/bash

# 定时通知测试脚本

BASE_URL="${BASE_URL:-https://pushover-scheduler.tomyail.workers.dev}"

echo "🔧 定时通知测试"
echo ""

# 1. 查看当前任务
echo "1️⃣  查看当前任务..."
TASKS_RESPONSE=$(curl -s "$BASE_URL/tasks")
echo "$TASKS_RESPONSE" | jq '.'
echo ""

# 2. 创建一个 2 秒后执行的任务
echo "2️⃣  创建一个 2 秒后执行的任务..."
SOON_TIME=$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) + timedelta(seconds=2)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"2 秒后执行的任务 - $(python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%H:%M:%S'))")\",
    \"title\": \"定时测试\",
    \"schedule\": {
      \"type\": \"once\",
      \"datetime\": \"$SOON_TIME\"
    },
    \"pushover\": {
      \"ttl\": 30
    }
  }" | jq '.'
echo ""

# 3. 创建一个 10 秒后执行的任务
echo "3️⃣  创建一个 10 秒后执行的任务..."
FUTURE_TIME=$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) + timedelta(seconds=10)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"10 秒后执行的任务 - $(python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).strftime('%H:%M:%S'))")\",
    \"title\": \"定时测试\",
    \"schedule\": {
      \"type\": \"once\",
      \"datetime\": \"$FUTURE_TIME\"
    },
    \"pushover\": {
      \"ttl\": 30
    }
  }" | jq '.'
echo ""

# 4. 创建一个当天 23:23 执行的任务（若已过则顺延到次日）
echo "4️⃣  创建一个 23:23 执行的任务..."
TIME_2323=$(python3 -c "from datetime import datetime, timedelta; from zoneinfo import ZoneInfo; tz=ZoneInfo('Asia/Shanghai'); now=datetime.now(tz); target=now.replace(hour=23, minute=23, second=0, microsecond=0); target=target if target>now else target+timedelta(days=1); print(target.strftime('%Y-%m-%dT%H:%M:%S'))")
curl -s -X POST "$BASE_URL/schedule" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"23:23 执行的任务 - $(python3 -c "from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%H:%M:%S'))")\",
    \"title\": \"定时测试\",
    \"schedule\": {
      \"type\": \"once\",
      \"datetime\": \"$TIME_2323\"
    },
    \"pushover\": {
      \"ttl\": 30
    }
  }" | jq '.'
echo ""

# 5. 再次查看任务
echo "5️⃣  再次查看所有任务..."
sleep 1
curl -s "$BASE_URL/tasks" | jq '.'
echo ""

# 6. 等待 12 秒执行
echo "6️⃣  等待 12 秒执行通知..."
sleep 12

# 7. 查看剩余任务
echo "7️⃣  查看剩余任务（一次性任务应该已被删除）..."
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
