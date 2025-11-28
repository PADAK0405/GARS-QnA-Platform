#!/bin/bash
# EC2 인스턴스에서 실행하여 데이터베이스 연결 설정을 수정하는 스크립트

echo "========================================="
echo "GARS 데이터베이스 연결 설정 수정 스크립트"
echo "========================================="

# 애플리케이션 디렉토리로 이동
cd /home/ec2-user/gars || cd /home/ubuntu/gars || { echo "애플리케이션 디렉토리를 찾을 수 없습니다."; exit 1; }

# AWS 리전 확인 (기본값: ap-northeast-2)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "ap-northeast-2")

echo "현재 리전: $REGION"

# RDS 엔드포인트 가져오기
echo "RDS 엔드포인트를 찾는 중..."

# 방법 1: AWS CLI로 직접 조회
DB_ENDPOINT=$(aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `gars`) || contains(DBInstanceIdentifier, `GARS`)].Endpoint.Address' --output text --region $REGION 2>/dev/null | head -1)

# 방법 2: CloudFormation 스택 출력에서 가져오기
if [ -z "$DB_ENDPOINT" ]; then
    echo "CloudFormation 스택에서 엔드포인트를 찾는 중..."
    STACK_NAME=$(aws cloudformation describe-stacks --query 'Stacks[?contains(StackName, `GARS`) || contains(StackName, `gars`)].StackName' --output text --region $REGION 2>/dev/null | head -1)
    if [ ! -z "$STACK_NAME" ]; then
        DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' --output text --region $REGION 2>/dev/null)
    fi
fi

# 방법 3: 사용자 입력 요청
if [ -z "$DB_ENDPOINT" ]; then
    echo "자동으로 RDS 엔드포인트를 찾을 수 없습니다."
    echo "RDS 콘솔에서 엔드포인트를 확인하고 입력해주세요:"
    echo "예: gars-database.xxxxxxxxx.ap-northeast-2.rds.amazonaws.com"
    read -p "RDS 엔드포인트: " DB_ENDPOINT
fi

if [ -z "$DB_ENDPOINT" ]; then
    echo "❌ RDS 엔드포인트를 입력하지 않았습니다. 스크립트를 종료합니다."
    exit 1
fi

echo "✅ RDS 엔드포인트: $DB_ENDPOINT"

# 데이터베이스 비밀번호 확인 (빈 비밀번호도 허용)
DB_PASSWORD=""

if [ -f .env ]; then
    CURRENT_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//')
    # 빈 문자열도 유효한 값으로 처리 (비밀번호가 없는 경우)
    if [ "$CURRENT_PASSWORD" != "\${DatabasePassword}" ]; then
        DB_PASSWORD="$CURRENT_PASSWORD"
        if [ -z "$DB_PASSWORD" ]; then
            echo "✅ 기존 .env 파일에서 빈 비밀번호를 확인했습니다."
        else
            echo "✅ 기존 .env 파일에서 비밀번호를 찾았습니다."
        fi
    fi
fi

# 비밀번호를 찾지 못한 경우 사용자에게 입력 요청
# DB_PASSWORD가 설정되지 않았거나 CloudFormation 변수로 남아있는 경우
if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "\${DatabasePassword}" ]; then
    echo ""
    echo "데이터베이스 비밀번호를 입력해주세요."
    echo "비밀번호가 없는 경우 그냥 Enter를 누르세요 (빈 비밀번호)."
    read -sp "DB_PASSWORD (Enter만 누르면 빈 비밀번호): " USER_PASSWORD
    echo ""
    DB_PASSWORD="$USER_PASSWORD"
fi

# DB_PASSWORD는 빈 문자열일 수 있으므로 체크하지 않음

# .env 파일 백업
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "기존 .env 파일을 백업했습니다."
fi

# .env 파일 생성/수정
cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=$DB_ENDPOINT
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=$DB_PASSWORD
DB_NAME=qna_hub
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
EOF

echo ""
echo "========================================="
echo "✅ .env 파일이 업데이트되었습니다:"
echo "========================================="
cat .env | sed 's/DB_PASSWORD=.*/DB_PASSWORD=***/'
echo "========================================="

# PM2 재시작
echo ""
echo "PM2 애플리케이션을 재시작하는 중..."
pm2 restart gars-app || pm2 restart all

echo ""
echo "✅ 완료! 애플리케이션이 재시작되었습니다."
echo ""
echo "연결 상태를 확인하려면 다음 명령어를 실행하세요:"
echo "  pm2 logs gars-app --lines 50"
echo ""

