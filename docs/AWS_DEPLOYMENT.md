# 🚀 AWS 배포 가이드

## 📋 목차
1. [사전 준비](#사전-준비)
2. [AWS RDS MySQL 설정](#aws-rds-mysql-설정)
3. [AWS EC2 인스턴스 설정](#aws-ec2-인스턴스-설정)
4. [애플리케이션 배포](#애플리케이션-배포)
5. [도메인 및 HTTPS 설정](#도메인-및-https-설정)

---

## 사전 준비

### 필요한 것들
- ✅ AWS 계정
- ✅ SSH 클라이언트 (Windows: PuTTY 또는 WSL, Mac/Linux: 터미널)
- ✅ 도메인 (선택사항, 무료: Freenom, 유료: AWS Route 53)

---

## AWS RDS MySQL 설정

### 1. RDS 데이터베이스 생성

1. AWS Console → **RDS** 서비스 접속
2. **데이터베이스 생성** 클릭
3. 설정:
   ```
   엔진 유형: MySQL
   버전: MySQL 8.0.x (최신)
   템플릿: 프리 티어 (또는 운영 환경)
   DB 인스턴스 식별자: qna-hub-db
   마스터 사용자 이름: admin
   마스터 암호: [강력한 비밀번호 입력]
   DB 인스턴스 클래스: db.t3.micro (프리 티어)
   스토리지: 20GB (프리 티어 범위)
   퍼블릭 액세스: 예 (개발 시) / 아니요 (프로덕션 권장)
   ```

4. **추가 구성**:
   ```
   초기 데이터베이스 이름: qna_hub
   백업 보존 기간: 7일
   암호화 활성화: 예
   ```

5. **데이터베이스 생성** 클릭 (5~10분 소요)

### 2. 보안 그룹 설정

1. RDS 인스턴스 선택 → **연결 & 보안** 탭
2. VPC 보안 그룹 클릭
3. **인바운드 규칙 편집**:
   ```
   유형: MySQL/Aurora
   포트: 3306
   소스: EC2 보안 그룹 ID (또는 개발 시 내 IP)
   ```

### 3. 엔드포인트 확인

RDS 인스턴스 → **연결 & 보안** → **엔드포인트** 복사
```
예: qna-hub-db.xxxxxxxxx.ap-northeast-2.rds.amazonaws.com
```

---

## AWS EC2 인스턴스 설정

### 1. EC2 인스턴스 생성

1. AWS Console → **EC2** 서비스
2. **인스턴스 시작** 클릭
3. 설정:
   ```
   이름: qna-hub-server
   AMI: Ubuntu Server 22.04 LTS
   인스턴스 유형: t2.micro (프리 티어)
   키 페어: 새로 생성 → qna-hub-key.pem 다운로드 (안전하게 보관!)
   ```

4. **네트워크 설정**:
   ```
   VPC: 기본 VPC
   퍼블릭 IP 자동 할당: 활성화
   방화벽(보안 그룹):
     - SSH (22): 내 IP
     - HTTP (80): 0.0.0.0/0
     - HTTPS (443): 0.0.0.0/0
     - Custom TCP (3000): 0.0.0.0/0 (개발 시만)
   ```

5. **스토리지**: 8GB (프리 티어)
6. **인스턴스 시작**

### 2. Elastic IP 할당 (선택사항)

고정 IP 주소를 원하면:
1. **Elastic IP** → **Elastic IP 주소 할당**
2. 할당된 IP를 EC2 인스턴스에 연결

---

## 애플리케이션 배포

### 1. EC2 접속

**Windows (PowerShell):**
```bash
ssh -i "qna-hub-key.pem" ubuntu@[EC2-퍼블릭-IP]
```

**Mac/Linux:**
```bash
chmod 400 qna-hub-key.pem
ssh -i "qna-hub-key.pem" ubuntu@[EC2-퍼블릭-IP]
```

### 2. 서버 환경 설정

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치 (v20.x)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Git 설치
sudo apt install -y git

# MySQL 클라이언트 설치 (RDS 접속용)
sudo apt install -y mysql-client

# PM2 설치 (프로세스 관리자)
sudo npm install -g pm2
```

### 3. 애플리케이션 배포

```bash
# 프로젝트 클론 (또는 파일 업로드)
git clone [YOUR_REPO_URL] qna-hub
cd qna-hub

# 의존성 설치
npm install

# .env 파일 생성
nano .env
```

**.env 파일 내용:**
```env
PORT=3000
NODE_ENV=production

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Session
SESSION_SECRET=very_secure_random_string_here_change_this

# MySQL RDS
DB_HOST=qna-hub-db.xxxxxxxxx.ap-northeast-2.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your_rds_password
DB_NAME=qna_hub

# Connection Pool
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
```

### 4. 데이터베이스 초기화

```bash
# RDS 연결 테스트
mysql -h [RDS_ENDPOINT] -u admin -p

# 데이터베이스 생성 (이미 생성했다면 스킵)
CREATE DATABASE qna_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qna_hub;

# 스키마 적용
source database/schema.sql;

# 확인
SHOW TABLES;
EXIT;
```

또는 Node.js로:
```bash
node -e "const DB = require('./database/queries'); DB.initializeDatabase();"
```

### 5. PM2로 앱 실행

```bash
# 앱 시작
pm2 start server.js --name qna-hub

# 상태 확인
pm2 status

# 로그 확인
pm2 logs qna-hub

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

### 6. Nginx 리버스 프록시 설정 (선택사항, 권장)

```bash
# Nginx 설치
sudo apt install -y nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/qna-hub
```

**Nginx 설정:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/qna-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 도메인 및 HTTPS 설정

### 1. 도메인 연결

**AWS Route 53 사용:**
1. Route 53 → **호스팅 영역 생성**
2. A 레코드 추가:
   ```
   이름: @
   유형: A
   값: [EC2 Elastic IP 또는 퍼블릭 IP]
   ```

**외부 도메인 사용:**
- DNS 설정에서 A 레코드를 EC2 IP로 지정

### 2. SSL 인증서 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 자동 갱신 설정
sudo certbot renew --dry-run
```

### 3. 환경 변수 업데이트

```bash
nano .env
```

```env
# CALLBACK_URL을 HTTPS 도메인으로 변경
CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

```bash
# 앱 재시작
pm2 restart qna-hub
```

---

## 🔒 보안 체크리스트

- [ ] RDS 퍼블릭 액세스 비활성화 (VPC 내부에서만 접근)
- [ ] EC2 SSH 접근을 내 IP로 제한
- [ ] .env 파일 권한 설정: `chmod 600 .env`
- [ ] SESSION_SECRET 강력한 랜덤 문자열 사용
- [ ] MySQL 사용자 권한 최소화
- [ ] AWS IAM 역할 활용
- [ ] CloudWatch로 모니터링 설정
- [ ] 정기적인 백업 설정

---

## 📊 모니터링 & 유지보수

### PM2 모니터링
```bash
pm2 monit                    # 실시간 모니터링
pm2 logs qna-hub            # 로그 확인
pm2 restart qna-hub         # 재시작
pm2 stop qna-hub            # 중지
```

### 데이터베이스 백업
```bash
# 수동 백업
mysqldump -h [RDS_ENDPOINT] -u admin -p qna_hub > backup_$(date +%Y%m%d).sql

# 자동 백업은 RDS 설정에서 활성화
```

### 업데이트 배포
```bash
cd ~/qna-hub
git pull origin main
npm install
pm2 restart qna-hub
```

---

## 💰 비용 예상 (프리 티어 기준)

- EC2 t2.micro: 무료 (12개월)
- RDS db.t3.micro: 무료 (12개월, 750시간/월)
- 스토리지: 무료 (30GB까지)
- 데이터 전송: 무료 (15GB 아웃바운드/월)

**프리 티어 이후**: 월 $10-20 예상

---

## 🆘 문제 해결

### 데이터베이스 연결 실패
```bash
# 보안 그룹 확인
# RDS 엔드포인트 확인
# .env 파일 설정 확인
```

### 앱이 시작되지 않음
```bash
pm2 logs qna-hub --lines 100
node server.js  # 직접 실행하여 에러 확인
```

### 메모리 부족
```bash
# 스왑 메모리 추가
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

