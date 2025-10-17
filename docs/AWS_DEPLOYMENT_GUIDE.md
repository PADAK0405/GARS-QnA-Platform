# 🚀 GARS AWS 배포 가이드

이 가이드는 GARS Q&A 플랫폼을 AWS에 배포하는 방법을 단계별로 설명합니다.

## 📋 사전 준비사항

### 1. AWS 계정 설정
- [AWS 계정 생성](https://aws.amazon.com/)
- [AWS CLI 설치](https://aws.amazon.com/cli/)
- [AWS 자격 증명 설정](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)

### 2. 필수 도구 설치
```bash
# Windows (PowerShell)
# AWS CLI 설치 후
aws --version

# Git 설치 확인
git --version

# Node.js 설치 확인
node --version
npm --version
```

### 3. 프로젝트 준비
```bash
# 프로젝트 디렉토리로 이동
cd C:\Users\00gin\OneDrive\Desktop\GARS

# Git 저장소 초기화 (선택사항)
git init
git add .
git commit -m "Initial commit"
```

## 🔧 AWS 서비스 구성

### 1. EC2 인스턴스
- **용도**: 웹 서버 (Node.js 애플리케이션)
- **인스턴스 타입**: t2.micro (무료 티어)
- **OS**: Amazon Linux 2
- **보안 그룹**: HTTP(80), HTTPS(443), SSH(22), Node.js(3000)

### 2. RDS MySQL
- **용도**: 데이터베이스
- **인스턴스 클래스**: db.t3.micro (무료 티어)
- **스토리지**: 20GB
- **백업 보존**: 7일
- **Multi-AZ**: 비활성화 (비용 절약)

### 3. S3 버킷
- **용도**: 파일 업로드 저장소
- **버킷명**: gars-uploads-[고유번호]
- **퍼블릭 읽기**: 활성화

### 4. CloudFront
- **용도**: CDN 및 SSL 인증서
- **원본**: EC2 인스턴스
- **캐싱**: 동적 콘텐츠는 비활성화

## 🚀 배포 방법

### 방법 1: 자동 배포 (권장)

```bash
# 1. 배포 스크립트 실행 권한 부여 (Linux/Mac)
chmod +x deploy.sh

# 2. 배포 실행
npm run deploy:aws
# 또는
bash deploy.sh
```

### 방법 2: 수동 배포

#### 1단계: CloudFormation 스택 생성
```bash
# 스택 생성
aws cloudformation create-stack \
    --stack-name gars-stack \
    --template-body file://aws-deploy.yml \
    --capabilities CAPABILITY_IAM \
    --parameters ParameterKey=KeyName,ParameterValue=gars-keypair

# 스택 상태 확인
aws cloudformation describe-stacks --stack-name gars-stack
```

#### 2단계: EC2 키 페어 생성
```bash
# 키 페어 생성
aws ec2 create-key-pair \
    --key-name gars-keypair \
    --query 'KeyMaterial' \
    --output text > gars-keypair.pem

# 키 파일 권한 설정 (Linux/Mac)
chmod 400 gars-keypair.pem
```

#### 3단계: 데이터베이스 마이그레이션
```bash
# 로컬 데이터 백업
npm run db:backup

# AWS RDS로 데이터 복원
npm run db:migrate
```

## 📁 환경 변수 설정

### .env 파일 생성
```bash
NODE_ENV=production
PORT=3000
DB_HOST=your-rds-endpoint.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-secure-password
DB_NAME=qna_hub
SESSION_SECRET=your-session-secret
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-2
S3_BUCKET=gars-uploads-123456789
```

## 🔍 배포 후 확인사항

### 1. 서비스 상태 확인
```bash
# EC2 인스턴스에 SSH 접속
ssh -i gars-keypair.pem ec2-user@your-ec2-ip

# PM2 상태 확인
pm2 status

# 애플리케이션 로그 확인
pm2 logs gars-app

# Nginx 상태 확인
sudo systemctl status nginx
```

### 2. 웹사이트 접속 테스트
- **HTTP**: http://your-ec2-ip
- **CloudFront**: http://your-cloudfront-url
- **관리자 페이지**: http://your-ec2-ip/admin.html

### 3. 데이터베이스 연결 테스트
```bash
# RDS 연결 테스트
mysql -h your-rds-endpoint -u admin -p qna_hub

# 테이블 확인
SHOW TABLES;
SELECT COUNT(*) FROM users;
```

## 🛠️ 문제 해결

### 일반적인 문제들

#### 1. EC2 인스턴스에 접속할 수 없는 경우
```bash
# 보안 그룹 확인
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

# SSH 포트(22)가 열려있는지 확인
# 0.0.0.0/0에서 22번 포트 접속 허용되어야 함
```

#### 2. 데이터베이스 연결 오류
```bash
# RDS 보안 그룹 확인
# EC2 보안 그룹에서 3306번 포트 접속 허용되어야 함

# 데이터베이스 엔드포인트 확인
aws rds describe-db-instances --db-instance-identifier gars-database
```

#### 3. 애플리케이션이 시작되지 않는 경우
```bash
# EC2에 접속하여 로그 확인
pm2 logs gars-app

# 환경 변수 확인
cat .env

# 포트 사용 확인
netstat -tlnp | grep :3000
```

### 로그 확인 방법

#### 1. CloudWatch 로그
```bash
# CloudWatch 로그 그룹 확인
aws logs describe-log-groups

# 실시간 로그 스트리밍
aws logs tail /aws/ec2/gars-app --follow
```

#### 2. EC2 로그
```bash
# 시스템 로그
sudo tail -f /var/log/messages

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 💰 비용 최적화

### 무료 티어 활용
- **EC2**: t2.micro 인스턴스 (750시간/월)
- **RDS**: db.t3.micro (750시간/월)
- **S3**: 5GB 스토리지
- **데이터 전송**: 1GB/월

### 비용 모니터링
```bash
# 비용 알림 설정
aws budgets create-budget \
    --account-id 123456789012 \
    --budget file://budget.json
```

## 🔄 업데이트 및 배포

### 코드 업데이트
```bash
# 1. 로컬에서 코드 수정
# 2. Git 커밋
git add .
git commit -m "Update feature"
git push origin main

# 3. EC2에서 코드 업데이트
ssh -i gars-keypair.pem ec2-user@your-ec2-ip
cd /home/ec2-user/gars
git pull origin main
npm install
pm2 restart gars-app
```

### 데이터베이스 업데이트
```bash
# 스키마 변경 시
npm run db:migrate
```

## 📞 지원 및 문의

배포 중 문제가 발생하면 다음을 확인하세요:

1. **AWS 콘솔**: CloudFormation, EC2, RDS 상태 확인
2. **로그 파일**: CloudWatch, PM2, Nginx 로그 확인
3. **보안 그룹**: 포트 및 IP 접근 권한 확인
4. **환경 변수**: .env 파일 설정 확인

---

🎉 **축하합니다!** GARS가 AWS에서 성공적으로 실행되고 있습니다!
