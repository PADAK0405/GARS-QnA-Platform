# Gaon QandA 🎓

> 함께 성장하는 지식 공유 커뮤니티

질문하고 답변하며 함께 배우는 Q&A 플랫폼입니다. AI 도우미가 이미지 OCR과 문제 풀이를 자동으로 도와줍니다.

## ✨ 주요 기능

- 📝 **질문 & 답변** - 궁금한 것을 질문하고 답변을 공유
- 🤖 **AI 자동 답변** - Google Gemini AI가 이미지 OCR 및 문제 풀이
- 🖼️ **이미지 첨부** - 문제 사진을 올리면 AI가 자동 분석
- 🏆 **레벨업 시스템** - 질문/답변으로 EXP 획득 및 레벨업
- 🎮 **개성 있는 프로필** - 상태메시지와 레벨별 칭호 시스템
- 🔐 **Google 로그인** - 간편하고 안전한 OAuth 인증
- 📱 **반응형 디자인** - 모바일, 태블릿, 데스크톱 지원

## 🚀 빠른 시작

### 로컬 개발 환경

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/GARS.git
cd GARS

# 2. 의존성 설치
npm install

# 3. MySQL 시작 (XAMPP 등)
# Windows: XAMPP Control Panel에서 MySQL Start

# 4. 환경 변수 설정
cp config/env.example.txt .env
nano .env  # 필요한 값 입력

# 5. 서버 시작 (자동으로 데이터베이스 초기화 및 스키마 업데이트)
npm start
```

브라우저에서 `http://localhost:3000` 접속!

### AWS 배포

```bash
# EC2 서버에서 실행
bash scripts/deploy-setup.sh
```

자세한 내용은 [AWS 빠른 배포 가이드](docs/AWS_QUICK_DEPLOY.md) 참고

## 📋 필수 설정

### 1. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 및 OAuth 2.0 클라이언트 ID 발급
3. `.env` 파일에 추가:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

상세 가이드: [GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)

### 2. Google Gemini AI 설정 (선택)

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 에서 API 키 발급
2. `.env` 파일에 추가:
   ```
   GEMINI_API_KEY=your_api_key
   ```

상세 가이드: [GEMINI_SETUP.md](docs/GEMINI_SETUP.md)

### 3. MySQL 데이터베이스

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=qna_hub
```

## 🛠️ 기술 스택

### Backend
- **Node.js** + **Express** - 서버 프레임워크
- **MySQL** - 데이터베이스
- **Passport.js** - Google OAuth 인증
- **Multer** - 이미지 업로드
- **Google Gemini AI** - 이미지 OCR 및 문제 풀이

### Frontend
- **Vanilla JavaScript** - 프레임워크 없이 경량화
- **CSS3** - 모던 스타일링
- **반응형 디자인** - 모바일 우선

### Deployment
- **AWS EC2** - 서버 호스팅
- **AWS RDS** - MySQL 데이터베이스
- **PM2** - 프로세스 관리
- **Nginx** - 리버스 프록시 (선택)

## 📁 프로젝트 구조

```
GARS/
├── public/              # 프론트엔드 파일
│   ├── index.html       # 홈페이지
│   ├── questions.html   # 질문 목록
│   ├── ask.html         # 질문하기
│   ├── ranking.html     # 랭킹
│   ├── script.js        # 메인 JS
│   ├── style.css        # 스타일
│   └── protection.js    # 소스 보호
├── database/            # 데이터베이스
│   ├── connection.js    # DB 연결
│   ├── queries.js       # 쿼리 모듈
│   └── schema.sql       # DB 스키마
├── utils/               # 유틸리티
│   └── gemini-ai.js     # AI 기능
├── scripts/             # 스크립트
│   ├── init-db.js       # DB 초기화
│   ├── reset-db.js      # DB 완전 초기화
│   └── deploy-setup.sh  # AWS 배포 스크립트
├── docs/                # 문서
│   ├── AWS_QUICK_DEPLOY.md
│   ├── AWS_DEPLOYMENT.md
│   ├── GEMINI_SETUP.md
│   └── GOOGLE_OAUTH_SETUP.md
├── server.js            # 메인 서버
├── package.json         # 의존성
└── .env                 # 환경 변수 (생성 필요)
```

## 📚 문서

- [빠른 AWS 배포](docs/AWS_QUICK_DEPLOY.md) - 20분 안에 배포
- [상세 AWS 배포](docs/AWS_DEPLOYMENT.md) - 전체 배포 가이드
- [Gemini AI 설정](docs/GEMINI_SETUP.md) - AI 기능 활성화
- [Google OAuth 설정](docs/GOOGLE_OAUTH_SETUP.md) - 로그인 설정

## 🔧 유용한 명령어

```bash
# 개발
npm start                    # 서버 시작
npm run dev                  # 개발 모드 (nodemon)

# 데이터베이스
node scripts/init-db.js      # DB 초기화
node scripts/reset-db.js     # DB 완전 초기화

# 배포 (EC2)
bash scripts/deploy-setup.sh # 배포 설정
pm2 start server.js          # PM2로 시작
pm2 logs                     # 로그 보기
pm2 restart all              # 재시작
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

This project is licensed under the MIT License.

## 🆘 문제 해결

### MySQL 연결 오류
- XAMPP에서 MySQL이 실행 중인지 확인
- `.env` 파일의 DB_PASSWORD가 비어있는지 확인 (XAMPP 기본값)

### Google OAuth 오류
- 콜백 URL이 정확한지 확인
- `http://localhost:3000/auth/google/callback`

### AI 답변이 생성되지 않음
- `GEMINI_API_KEY`가 설정되었는지 확인
- 일일 API 한도를 확인

자세한 내용은 각 문서 참고!

## 📧 연락처

프로젝트 링크: [https://github.com/your-username/GARS](https://github.com/your-username/GARS)

---

Made with ❤️ by Gaon Team
