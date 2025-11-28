#!/bin/bash
# 빠른 DB 연결 수정 스크립트

cd ~/gars || exit 1

# RDS 엔드포인트 가져오기
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "ap-northeast-2")
DB_ENDPOINT=$(aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `gars`) || contains(DBInstanceIdentifier, `GARS`)].Endpoint.Address' --output text --region $REGION 2>/dev/null | head -1)

if [ -z "$DB_ENDPOINT" ]; then
    echo "❌ RDS 엔드포인트를 찾을 수 없습니다."
    echo "수동으로 입력해주세요:"
    read -p "RDS 엔드포인트: " DB_ENDPOINT
fi

if [ -z "$DB_ENDPOINT" ]; then
    echo "❌ 엔드포인트가 없습니다. 종료합니다."
    exit 1
fi

echo "✅ RDS 엔드포인트: $DB_ENDPOINT"

# .env 파일 백업
[ -f .env ] && cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# .env 파일 생성
cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=$DB_ENDPOINT
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=
DB_NAME=qna_hub
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
EOF

echo ""
echo "✅ .env 파일이 업데이트되었습니다:"
echo "DB_HOST=$DB_ENDPOINT"
echo "DB_PASSWORD=(빈 비밀번호)"
echo ""

# PM2 재시작
echo "PM2 재시작 중..."
pm2 delete gars-app 2>/dev/null
pm2 start server.js --name gars-app
sleep 2
pm2 logs gars-app --lines 20

