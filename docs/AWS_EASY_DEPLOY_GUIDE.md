# 🚀 GARS AWS 배포 - 초보자용 완전 가이드

> **이 가이드는 AWS를 처음 사용하는 분들을 위한 단계별 설명서입니다!**  
> 복잡한 기술 용어 없이 쉽게 따라할 수 있도록 작성되었습니다.

## 📋 목차
1. [사전 준비사항](#1-사전-준비사항)
2. [AWS 계정 설정](#2-aws-계정-설정)
3. [프로젝트 준비](#3-프로젝트-준비)
4. [AWS 배포 실행](#4-aws-배포-실행)
5. [배포 확인](#5-배포-확인)
6. [문제 해결](#6-문제-해결)

---

## 1. 사전 준비사항

### 🎯 무엇을 준비해야 하나요?

#### **필수 준비물:**
- ✅ **컴퓨터** (Windows, Mac, Linux 모두 가능)
- ✅ **인터넷 연결**
- ✅ **신용카드** (AWS 계정 생성용 - 무료 티어로 비용 없음)
- ✅ **GARS 프로젝트** (이미 준비됨!)

#### **설치해야 할 프로그램:**
1. **AWS CLI** (AWS 명령어 도구)
2. **Git** (코드 관리 도구)

---

## 2. AWS 계정 설정

### 🔑 2-1. AWS 계정 만들기

#### **Step 1: AWS 웹사이트 접속**
1. 브라우저에서 [aws.amazon.com](https://aws.amazon.com) 접속
2. 우측 상단 **"AWS 계정 만들기"** 클릭

#### **Step 2: 계정 정보 입력**
```
이메일 주소: your-email@gmail.com
비밀번호: 안전한 비밀번호 입력
AWS 계정 이름: GARS-Project
```

#### **Step 3: 결제 정보 입력**
- **중요**: 신용카드 정보 입력 (무료 티어로 비용 발생 안함)
- 주소 정보 입력

#### **Step 4: 휴대폰 인증**
- 휴대폰 번호 입력
- SMS 인증 코드 입력

#### **Step 5: 지원 플랜 선택**
- **"Basic Support - 무료"** 선택

### 🔧 2-2. AWS CLI 설치

#### **Windows 사용자:**
1. [AWS CLI 다운로드](https://aws.amazon.com/cli/) 접속
2. **"AWS CLI MSI installer for Windows (64-bit)"** 다운로드
3. 다운로드한 파일 실행하여 설치
4. 설치 완료 후 명령 프롬프트 열기

#### **Mac 사용자:**
```bash
# 터미널에서 실행
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

#### **Linux 사용자:**
```bash
# 터미널에서 실행
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 🎫 2-3. AWS 자격 증명 설정

#### **Step 1: AWS 콘솔에서 키 생성**
1. [AWS 콘솔](https://console.aws.amazon.com) 접속
2. 우측 상단 계정명 클릭 → **"보안 자격 증명"**
3. **"액세스 키"** 탭 클릭
4. **"새 액세스 키 만들기"** 클릭
5. **"명령줄 인터페이스(CLI)"** 선택
6. **"키 만들기"** 클릭
7. **중요**: Access Key ID와 Secret Access Key를 안전한 곳에 저장!

#### **Step 2: 컴퓨터에서 AWS 설정**
```bash
# 명령 프롬프트(PowerShell) 또는 터미널에서 실행
aws configure
```

**입력할 내용:**
```
AWS Access Key ID: AKIA... (위에서 복사한 키)
AWS Secret Access Key: abc123... (위에서 복사한 키)
Default region name: ap-northeast-2 (서울 리전)
Default output format: json
```

---

## 3. 프로젝트 준비

### 📁 3-1. 환경 변수 파일 생성

#### **Step 1: .env 파일 만들기**
1. GARS 프로젝트 폴더로 이동
2. 새 파일 생성: `.env` (점으로 시작)
3. 다음 내용 복사해서 붙여넣기:

```bash
# GARS AWS 배포용 환경 변수
NODE_ENV=production
PORT=3000

# 데이터베이스 설정 (배포 시 자동 업데이트됨)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=qna_hub

# 세션 보안 (새로 생성된 시크릿 키)
SESSION_SECRET=your-session-secret-here

# AI 서비스 (기존 키 사용)
GEMINI_API_KEY=your-gemini-api-key

# Google OAuth 설정 (기존 키 사용)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AWS 설정 (배포 시 자동 설정됨)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-2
S3_BUCKET=gars-uploads-123456789
```

#### **Step 2: 실제 값으로 수정**
- `your-session-secret-here`: 랜덤한 긴 문자열 (예: `abc123def456ghi789...`)
- `your-gemini-api-key`: 기존에 사용하던 Gemini API 키
- `your-google-client-id`: 기존에 사용하던 Google OAuth 클라이언트 ID
- `your-google-client-secret`: 기존에 사용하던 Google OAuth 시크릿

### 🔑 3-2. EC2 키 페어 생성

#### **Step 1: AWS 콘솔에서 키 페어 생성**
1. [AWS EC2 콘솔](https://console.aws.amazon.com/ec2/) 접속
2. 왼쪽 메뉴 **"키 페어"** 클릭
3. **"키 페어 생성"** 클릭
4. 키 페어 이름: `gars-keypair`
5. 키 페어 유형: **RSA**
6. 개인 키 파일 형식: **.pem**
7. **"키 페어 생성"** 클릭
8. 다운로드된 `.pem` 파일을 안전한 곳에 저장

#### **Step 2: 명령어로 키 페어 생성 (선택사항)**
```bash
# PowerShell에서 실행
aws ec2 create-key-pair --key-name gars-keypair --query 'KeyMaterial' --output text > gars-keypair.pem
```

---

## 4. AWS 배포 실행

### 🚀 4-1. 자동 배포 (권장)

#### **Step 1: 배포 스크립트 실행**
```bash
# GARS 프로젝트 폴더에서 실행
bash deploy.sh
```

#### **Step 2: 배포 과정 확인**
배포 스크립트가 다음 작업들을 자동으로 수행합니다:

```
🔄 AWS CLI 설치 확인 중...
✅ AWS CLI가 설치되어 있습니다.

🔄 AWS 자격 증명 확인 중...
✅ AWS 자격 증명이 설정되어 있습니다.

🔄 프로젝트 파일 준비 중...
✅ 프로젝트 파일이 준비되었습니다.

🔄 CloudFormation 스택 배포 중...
✅ CloudFormation 스택 생성이 시작되었습니다.

🔄 스택 생성 완료를 기다리는 중... (약 10-15분 소요)
✅ 스택 생성이 완료되었습니다!

🎉 GARS 배포가 완료되었습니다!
```

### 🔧 4-2. 수동 배포 (고급 사용자용)

#### **Step 1: CloudFormation 스택 생성**
```bash
aws cloudformation create-stack \
    --stack-name gars-stack \
    --template-body file://aws-deploy.yml \
    --capabilities CAPABILITY_IAM \
    --parameters ParameterKey=KeyName,ParameterValue=gars-keypair
```

#### **Step 2: 스택 생성 완료 대기**
```bash
aws cloudformation wait stack-create-complete --stack-name gars-stack
```

---

## 5. 배포 확인

### 🌐 5-1. 웹사이트 접속 확인

#### **배포 완료 후 표시되는 정보:**
```
📊 배포 정보:
  🌐 웹 서버 IP: 3.34.123.456
  🗄️  데이터베이스: gars-database.abc123.ap-northeast-2.rds.amazonaws.com
  ☁️  CloudFront URL: d1234567890.cloudfront.net
  📦 S3 버킷: gars-uploads-123456789
```

#### **접속 테스트:**
1. **메인 페이지**: `http://3.34.123.456`
2. **관리자 페이지**: `http://3.34.123.456/admin.html`
3. **질문 목록**: `http://3.34.123.456/questions.html`

### 🔍 5-2. 서비스 상태 확인

#### **EC2 서버 상태 확인:**
```bash
# SSH로 서버 접속 (Windows PowerShell)
ssh -i gars-keypair.pem ec2-user@3.34.123.456

# 서버 접속 후 실행
pm2 status          # 애플리케이션 상태 확인
pm2 logs gars-app   # 애플리케이션 로그 확인
sudo systemctl status nginx  # 웹 서버 상태 확인
```

#### **데이터베이스 연결 확인:**
```bash
# 데이터베이스 마이그레이션 실행
npm run db:migrate
```

---

## 6. 문제 해결

### ❌ 6-1. 자주 발생하는 문제들

#### **문제 1: "AWS CLI가 설치되어 있지 않습니다"**
```bash
# 해결방법: AWS CLI 재설치
# Windows: https://aws.amazon.com/cli/ 에서 다운로드
# Mac/Linux: 위의 설치 가이드 참조
```

#### **문제 2: "AWS 자격 증명이 설정되어 있지 않습니다"**
```bash
# 해결방법: AWS 자격 증명 재설정
aws configure
# Access Key ID와 Secret Access Key 다시 입력
```

#### **문제 3: "키 페어를 찾을 수 없습니다"**
```bash
# 해결방법: 키 페어 재생성
aws ec2 create-key-pair --key-name gars-keypair --query 'KeyMaterial' --output text > gars-keypair.pem
```

#### **문제 4: 웹사이트에 접속할 수 없습니다**
1. **보안 그룹 확인**: EC2 콘솔에서 80, 443 포트가 열려있는지 확인
2. **서버 상태 확인**: SSH로 접속해서 `pm2 status` 실행
3. **방화벽 확인**: Windows 방화벽에서 80, 443 포트 허용

### 🔧 6-2. 로그 확인 방법

#### **애플리케이션 로그:**
```bash
# EC2 서버 접속 후
pm2 logs gars-app
```

#### **웹 서버 로그:**
```bash
# EC2 서버 접속 후
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### **AWS CloudWatch 로그:**
```bash
# 로컬에서 실행
aws logs describe-log-groups
aws logs tail /aws/ec2/gars-app --follow
```

### 💰 6-3. 비용 관리

#### **무료 티어 확인:**
- **EC2**: t2.micro 인스턴스 (750시간/월 무료)
- **RDS**: db.t3.micro (750시간/월 무료)
- **S3**: 5GB 스토리지 무료
- **데이터 전송**: 1GB/월 무료

#### **비용 모니터링:**
1. [AWS 비용 관리 콘솔](https://console.aws.amazon.com/cost-management/) 접속
2. **"비용 및 사용량"** 메뉴에서 실시간 비용 확인
3. **"예산"** 설정으로 비용 알림 받기

---

## 🎉 완료!

축하합니다! GARS가 AWS에서 성공적으로 실행되고 있습니다!

### **다음 단계:**
1. **도메인 연결** (선택사항): Route 53으로 커스텀 도메인 설정
2. **SSL 인증서** (선택사항): Let's Encrypt로 HTTPS 설정
3. **백업 설정**: RDS 자동 백업 활성화
4. **모니터링**: CloudWatch 알람 설정

### **유용한 명령어들:**
```bash
# 애플리케이션 재시작
pm2 restart gars-app

# 로그 실시간 확인
pm2 logs gars-app --follow

# 데이터베이스 백업
npm run db:backup

# 데이터베이스 복원
npm run db:restore

# 서버 상태 확인
pm2 status
```

### **지원 및 도움:**
- **AWS 공식 문서**: [docs.aws.amazon.com](https://docs.aws.amazon.com/)
- **AWS 지원**: [console.aws.amazon.com/support](https://console.aws.amazon.com/support/)
- **GARS 프로젝트**: 이 저장소의 Issues 탭

---

**🎯 이제 GARS를 전 세계 어디서든 접속할 수 있습니다!**
