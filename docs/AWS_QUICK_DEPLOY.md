# ⚡ AWS 빠른 배포 가이드 (2024)

## 🎯 가장 빠른 방법: AWS EC2 + RDS

### 1단계: AWS RDS MySQL 생성 (5분)

1. **AWS Console** → **RDS** 
2. **데이터베이스 생성** 클릭
3. 빠른 설정:
   - 엔진: MySQL 8.0
   - 템플릿: **프리 티어**
   - DB 이름: `qna_hub`
   - 마스터 사용자: `admin`
   - 비밀번호: 설정
   - 퍼블릭 액세스: **예**

4. 생성 후 **엔드포인트 주소 복사** (예: `xxx.rds.amazonaws.com`)

---

### 2단계: AWS EC2 인스턴스 생성 (5분)

1. **AWS Console** → **EC2**
2. **인스턴스 시작** 클릭
3. 빠른 설정:
   - 이름: `gaon-qanda-server`
   - AMI: **Ubuntu Server 22.04 LTS**
   - 인스턴스 유형: **t2.micro** (프리 티어)
   - 키 페어: 새로 생성 또는 기존 사용
   - 보안 그룹:
     - SSH (22) - 내 IP
     - HTTP (80) - 0.0.0.0/0
     - HTTPS (443) - 0.0.0.0/0
     - Custom TCP (3000) - 0.0.0.0/0

4. **인스턴스 시작** 클릭

---

### 3단계: EC2 서버 접속 및 설정 (10분)

#### Windows (PowerShell 또는 WSL)
```bash
ssh -i "your-key.pem" ubuntu@your-ec2-public-ip
```

#### Mac/Linux
```bash
chmod 400 your-key.pem
ssh -i "your-key.pem" ubuntu@your-ec2-public-ip
```

#### 서버에서 실행:

```bash
# 1. 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 2. Node.js 설치 (v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Git, PM2, Nginx 설치
sudo apt install -y git nginx
sudo npm install -g pm2

# 4. 프로젝트 클론
cd ~
git clone https://github.com/your-username/GARS.git
cd GARS

# 5. 의존성 설치
npm install

# 6. 환경 변수 설정
nano .env
```

#### .env 파일 내용 (중요!)
```bash
PORT=3000
NODE_ENV=production

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CALLBACK_URL=http://your-ec2-public-ip:3000/auth/google/callback

# Session
SESSION_SECRET=your_random_secret_key_here_123456

# Gemini AI (선택)
GEMINI_API_KEY=your_gemini_api_key

# MySQL (RDS)
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your_rds_password
DB_NAME=qna_hub
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
```

**저장**: `Ctrl+X` → `Y` → `Enter`

---

### 4단계: 데이터베이스 초기화 (1분)

```bash
# 데이터베이스 테이블 생성
node scripts/init-db.js
```

출력:
```
✅ MySQL 데이터베이스 연결 성공!
✅ 데이터베이스 초기화 완료!
```

---

### 5단계: 서버 실행 (1분)

```bash
# PM2로 서버 실행 (자동 재시작)
pm2 start server.js --name gaon-qanda

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save

# 서버 상태 확인
pm2 status
pm2 logs gaon-qanda
```

---

### 6단계: 접속 테스트

브라우저에서:
```
http://your-ec2-public-ip:3000
```

✅ 접속 성공!

---

## 🔧 Google OAuth 콜백 URL 업데이트

### Google Cloud Console 설정

1. https://console.cloud.google.com/apis/credentials
2. OAuth 2.0 클라이언트 ID 선택
3. **승인된 리디렉션 URI**에 추가:
   ```
   http://your-ec2-public-ip:3000/auth/google/callback
   ```
4. 저장

---

## 🌐 도메인 연결 (선택사항)

### Nginx 리버스 프록시 설정

```bash
sudo nano /etc/nginx/sites-available/gaon-qanda
```

내용:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

활성화:
```bash
sudo ln -s /etc/nginx/sites-available/gaon-qanda /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

이제 `http://your-domain.com`으로 접속 가능!

---

## 🔒 HTTPS 설정 (무료 SSL)

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 및 자동 설정
sudo certbot --nginx -d your-domain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

이제 `https://your-domain.com`으로 접속 가능!

---

## 📊 유용한 명령어

### PM2 관리
```bash
pm2 status              # 서버 상태 확인
pm2 logs gaon-qanda     # 로그 보기
pm2 restart gaon-qanda  # 서버 재시작
pm2 stop gaon-qanda     # 서버 중지
pm2 delete gaon-qanda   # 서버 삭제
```

### 코드 업데이트
```bash
cd ~/GARS
git pull
npm install
pm2 restart gaon-qanda
```

### 데이터베이스 초기화
```bash
cd ~/GARS
node scripts/reset-db.js
```

---

## 💰 예상 비용

### AWS 프리 티어 사용 시 (12개월)
- **EC2 t2.micro**: 무료 (750시간/월)
- **RDS db.t3.micro**: 무료 (750시간/월)
- **데이터 전송**: 15GB/월 무료

### 프리 티어 이후
- **EC2 t2.micro**: ~$8/월
- **RDS db.t3.micro**: ~$15/월
- **총 예상**: ~$23/월

---

## 🆘 문제 해결

### 접속이 안 될 때
1. EC2 보안 그룹에서 포트 3000 열었는지 확인
2. `pm2 logs` 로 에러 확인
3. RDS 보안 그룹에서 EC2 IP 허용 확인

### MySQL 연결 오류
1. RDS 엔드포인트 주소 정확한지 확인
2. RDS 보안 그룹에서 EC2 보안 그룹 허용
3. `.env` 파일 DB_HOST, DB_PASSWORD 확인

### Google OAuth 오류
1. 콜백 URL이 정확한지 확인
2. Google Cloud Console에서 승인된 리디렉션 URI 확인
3. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 확인

---

## 🎉 완료!

이제 AWS에서 Gaon QandA가 실행 중입니다!

- 🌐 웹사이트: `http://your-ec2-ip:3000`
- 📊 서버 모니터링: `pm2 monit`
- 📝 로그: `pm2 logs gaon-qanda`

더 자세한 내용은 `AWS_DEPLOYMENT.md` 참고!


