# 🚀 빠른 시작 가이드

3분 안에 Gaon QandA를 로컬에서 실행하세요! (자동 설정 포함)

## ✅ 1단계: 사전 준비 확인

### Node.js 설치 확인
```bash
node --version  # v18.0.0 이상 필요
npm --version   # v9.0.0 이상 필요
```

설치 안 되어 있다면: [nodejs.org](https://nodejs.org)

### MySQL 설치 확인
```bash
mysql --version  # 8.0 이상 권장
```

설치 안 되어 있다면:
- **Windows**: [MySQL Installer](https://dev.mysql.com/downloads/installer/)
- **Mac**: `brew install mysql`
- **Ubuntu**: `sudo apt install mysql-server`

## 📦 2단계: 프로젝트 설정

### 의존성 설치
```bash
npm install
```

### MySQL 데이터베이스 생성
```bash
# MySQL 접속
mysql --version

# 데이터베이스 생성
CREATE DATABASE qna_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 데이터베이스 스키마 적용
```bash
npm run db:init
```

## 🔑 3단계: Google OAuth 설정

### Google Cloud Console 설정
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성
3. **API 및 서비스** → **OAuth 동의 화면** → 설정
4. **사용자 인증 정보** → **OAuth 2.0 클라이언트 ID** 생성
5. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:3000/auth/google/callback
   ```
6. 클라이언트 ID와 보안 비밀 복사

상세 가이드: [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)

## ⚙️ 4단계: 환경 변수 설정

### .env 파일 생성
프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 복사:

```env
# Server
PORT=3000
NODE_ENV=development

# Google OAuth (위에서 복사한 값 붙여넣기)
GOOGLE_CLIENT_ID=여기에_클라이언트_ID_입력
GOOGLE_CLIENT_SECRET=여기에_클라이언트_보안_비밀_입력
CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session
SESSION_SECRET=my_super_secret_key_change_in_production

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=qna_hub

# Connection Pool
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
```

**중요:** `DB_PASSWORD`를 본인의 MySQL 비밀번호로 변경하세요!

## 🚀 5단계: 서버 실행 (자동 설정)

```bash
npm start
```

**🎉 자동으로 처리되는 것들:**
- ✅ 데이터베이스 스키마 업데이트
- ✅ 레벨업 시스템 초기화
- ✅ 기존 사용자 레벨 정보 설정

또는 개발 모드 (자동 재시작):
```bash
npm run dev
```

## ✨ 6단계: 브라우저에서 접속

```
http://localhost:3000
```

### 확인할 것들
✅ 메인 페이지가 로드됨  
✅ "Google로 로그인" 버튼이 보임  
✅ 로그인 후 사용자 이름이 표시됨  
✅ 질문 작성 페이지 접근 가능  

## 🐛 문제 해결

### ❌ 데이터베이스 연결 오류
```
❌ MySQL 연결 실패: Access denied for user...
```
**해결**: `.env` 파일의 `DB_PASSWORD` 확인

```
❌ MySQL 연결 실패: Unknown database 'qna_hub'
```
**해결**: 2단계의 MySQL 데이터베이스 생성 다시 실행

### ❌ Google OAuth 오류
```
redirect_uri_mismatch
```
**해결**: Google Console의 리디렉션 URI가 정확히 `http://localhost:3000/auth/google/callback`인지 확인

```
invalid_client
```
**해결**: `.env` 파일의 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET` 확인

### ❌ 포트 3000 이미 사용 중
```
Error: listen EADDRINUSE: address already in use :::3000
```
**해결**: `.env`에서 `PORT=3001`로 변경하거나 기존 프로세스 종료

## 📚 다음 단계

### 로컬 개발
- [x] 로컬 서버 실행 성공
- [ ] 질문 작성 테스트
- [ ] 답변 작성 테스트
- [ ] 이미지 업로드 테스트

### 프로덕션 배포
- [ ] AWS RDS 설정
- [ ] AWS EC2 설정
- [ ] 도메인 연결
- [ ] SSL 인증서 설정

상세 가이드: [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md)

## 💡 유용한 명령어

```bash
# 데이터베이스 연결 테스트
npm test

# 데이터베이스 재초기화 (주의: 모든 데이터 삭제됨)
npm run db:init

# PM2로 프로세스 관리 (프로덕션)
npm run pm2:start    # 시작
npm run pm2:logs     # 로그 확인
npm run pm2:restart  # 재시작
npm run pm2:stop     # 중지
```

## 🎉 완료!

이제 Q&A Hub가 로컬에서 실행됩니다!

질문이나 문제가 있으면:
1. [README.md](README.md) 확인
2. [문제 해결 가이드](docs/AWS_DEPLOYMENT.md#-문제-해결) 참고
3. GitHub Issues에 문의

**즐거운 개발 되세요! 🚀**

