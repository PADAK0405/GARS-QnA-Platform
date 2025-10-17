#!/bin/bash

# GARS AWS 배포 스크립트
echo "🚀 GARS AWS 배포를 시작합니다..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. AWS CLI 확인
print_step "AWS CLI 설치 확인 중..."
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI가 설치되어 있지 않습니다."
    echo "다음 링크에서 AWS CLI를 설치하세요: https://aws.amazon.com/cli/"
    exit 1
fi
print_success "AWS CLI가 설치되어 있습니다."

# 2. AWS 자격 증명 확인
print_step "AWS 자격 증명 확인 중..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS 자격 증명이 설정되어 있지 않습니다."
    echo "다음 명령어로 AWS 자격 증명을 설정하세요:"
    echo "aws configure"
    exit 1
fi
print_success "AWS 자격 증명이 설정되어 있습니다."

# 3. 프로젝트 준비
print_step "프로젝트 파일 준비 중..."

# .env 파일 생성 (사용자 입력 받기)
if [ ! -f .env ]; then
    print_warning ".env 파일이 없습니다. 생성합니다..."
    cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=qna_hub
SESSION_SECRET=$(openssl rand -hex 32)
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
EOF
    print_warning ".env 파일을 생성했습니다. 실제 값으로 수정하세요."
fi

# 4. CloudFormation 스택 배포
print_step "CloudFormation 스택 배포 중..."

# 스택 이름 설정
STACK_NAME="gars-stack-$(date +%s)"

# CloudFormation 스택 생성
aws cloudformation create-stack \
    --stack-name $STACK_NAME \
    --template-body file://aws-deploy.yml \
    --capabilities CAPABILITY_IAM \
    --parameters ParameterKey=KeyName,ParameterValue=gars-keypair \
                 ParameterKey=InstanceType,ParameterValue=t2.micro

if [ $? -eq 0 ]; then
    print_success "CloudFormation 스택 생성이 시작되었습니다."
    echo "스택 이름: $STACK_NAME"
    
    # 스택 생성 완료 대기
    print_step "스택 생성 완료를 기다리는 중... (약 10-15분 소요)"
    aws cloudformation wait stack-create-complete --stack-name $STACK_NAME
    
    if [ $? -eq 0 ]; then
        print_success "스택 생성이 완료되었습니다!"
        
        # 출력 값 가져오기
        print_step "배포 정보를 가져오는 중..."
        
        WEB_SERVER_IP=$(aws cloudformation describe-stacks \
            --stack-name $STACK_NAME \
            --query 'Stacks[0].Outputs[?OutputKey==`WebServerPublicIP`].OutputValue' \
            --output text)
        
        DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
            --stack-name $STACK_NAME \
            --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
            --output text)
        
        CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
            --stack-name $STACK_NAME \
            --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
            --output text)
        
        S3_BUCKET=$(aws cloudformation describe-stacks \
            --stack-name $STACK_NAME \
            --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
            --output text)
        
        # 배포 정보 출력
        echo ""
        print_success "🎉 GARS 배포가 완료되었습니다!"
        echo ""
        echo "📊 배포 정보:"
        echo "  🌐 웹 서버 IP: $WEB_SERVER_IP"
        echo "  🗄️  데이터베이스: $DATABASE_ENDPOINT"
        echo "  ☁️  CloudFront URL: http://$CLOUDFRONT_URL"
        echo "  📦 S3 버킷: $S3_BUCKET"
        echo ""
        echo "🔧 다음 단계:"
        echo "  1. 웹 서버에 SSH 접속: ssh -i gars-keypair.pem ec2-user@$WEB_SERVER_IP"
        echo "  2. 애플리케이션 상태 확인: pm2 status"
        echo "  3. 로그 확인: pm2 logs gars-app"
        echo "  4. 웹사이트 접속: http://$WEB_SERVER_IP"
        echo ""
        print_warning "데이터베이스 마이그레이션을 위해 다음 명령어를 실행하세요:"
        echo "  mysqldump -u root -p qna_hub > gars_backup.sql"
        echo "  mysql -h $DATABASE_ENDPOINT -u admin -p qna_hub < gars_backup.sql"
        
    else
        print_error "스택 생성에 실패했습니다."
        echo "CloudFormation 콘솔에서 오류를 확인하세요:"
        echo "https://console.aws.amazon.com/cloudformation/"
        exit 1
    fi
else
    print_error "CloudFormation 스택 생성에 실패했습니다."
    exit 1
fi

print_success "배포 스크립트가 완료되었습니다!"
