# 🏗️ Q&A Hub 아키텍처 설계

## 📊 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                             │
│  (브라우저 - Chrome, Safari, Firefox 등)                     │
│  • index.html (질문 목록)                                     │
│  • ask.html (질문 작성)                                       │
│  • ranking.html (랭킹)                                        │
│  • script.js (클라이언트 로직)                                │
│  • style.css (스타일)                                         │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (리버스 프록시)                      │
│  • SSL/TLS 종료                                              │
│  • 정적 파일 서빙                                             │
│  • 로드 밸런싱                                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js 애플리케이션 (PM2)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ server.js (메인 서버)                                 │   │
│  │  • 라우팅                                            │   │
│  │  • 인증 (Passport.js)                                │   │
│  │  • 세션 관리                                          │   │
│  │  • API 엔드포인트                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ database/                                            │   │
│  │  • connection.js (연결 풀)                           │   │
│  │  • queries.js (쿼리 로직)                            │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│ Google OAuth │   │   MySQL (RDS)    │
│   Provider   │   │  ┌─────────────┐ │
│              │   │  │ users       │ │
└──────────────┘   │  │ questions   │ │
                   │  │ answers     │ │
                   │  │ images      │ │
                   │  └─────────────┘ │
                   └──────────────────┘
```

## 🗄️ 데이터베이스 스키마

### ERD (Entity Relationship Diagram)

```
┌──────────────────┐         ┌──────────────────┐
│      users       │         │    questions     │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │◄────────│ id (PK)          │
│ display_name     │         │ user_id (FK)     │
│ email            │         │ title            │
│ score            │         │ content          │
│ created_at       │         │ created_at       │
│ updated_at       │         │ updated_at       │
└──────────────────┘         └────────┬─────────┘
         ▲                            │
         │                            ▼
         │                   ┌──────────────────┐
         │                   │     answers      │
         │                   ├──────────────────┤
         │                   │ id (PK)          │
         └───────────────────┤ question_id (FK) │
                             │ user_id (FK)     │
                             │ content          │
                             │ created_at       │
                             │ updated_at       │
                             └────────┬─────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │     images       │
                             ├──────────────────┤
                             │ id (PK)          │
                             │ url              │
                             │ entity_type      │
                             │ entity_id (FK)   │
                             │ created_at       │
                             └──────────────────┘
```

### 테이블 상세

#### `users` - 사용자 정보
- **PK**: `id` (VARCHAR(255), Google ID)
- **인덱스**: `score DESC`, `created_at DESC`
- **특징**: Google OAuth 프로필 정보 저장

#### `questions` - 질문
- **PK**: `id` (AUTO_INCREMENT)
- **FK**: `user_id → users.id`
- **인덱스**: `user_id`, `created_at DESC`
- **Full-text 인덱스**: `title, content` (검색 기능)

#### `answers` - 답변
- **PK**: `id` (AUTO_INCREMENT)
- **FK**: 
  - `question_id → questions.id`
  - `user_id → users.id`
- **인덱스**: `question_id`, `user_id`, `created_at DESC`

#### `images` - 이미지
- **PK**: `id` (AUTO_INCREMENT)
- **관계**: Polymorphic (question 또는 answer)
- **인덱스**: `(entity_type, entity_id)`

## 🔄 요청 흐름

### 1. 사용자 로그인
```
클라이언트 → /auth/google
    ↓
Google OAuth 인증
    ↓
/auth/google/callback
    ↓
Passport.js 처리
    ↓
Database.findOrCreateUser()
    ↓
세션 생성
    ↓
메인 페이지로 리디렉션
```

### 2. 질문 생성
```
클라이언트 → POST /api/questions
    ↓
인증 확인 (req.user)
    ↓
이미지 업로드 (선택)
    ↓
Database.createQuestion()
    ├─ BEGIN TRANSACTION
    ├─ INSERT question
    ├─ INSERT images (if any)
    └─ COMMIT
    ↓
응답 (201 Created)
```

### 3. 답변 생성
```
클라이언트 → POST /api/questions/:id/answers
    ↓
인증 확인
    ↓
질문 존재 확인
    ↓
Database.createAnswer()
    ├─ BEGIN TRANSACTION
    ├─ INSERT answer
    ├─ INSERT images (if any)
    ├─ UPDATE users SET score += 10
    └─ COMMIT
    ↓
응답 (201 Created)
```

## ⚡ 성능 최적화

### 1. Connection Pooling
```javascript
{
    connectionLimit: 10,      // 최대 10개 연결 재사용
    queueLimit: 0,            // 무제한 대기열
    waitForConnections: true, // 연결 대기
    enableKeepAlive: true     // 연결 유지
}
```

**장점**:
- 연결 생성/종료 오버헤드 제거
- 메모리 사용량 제어
- 동시 요청 처리 능력 향상

### 2. 병렬 쿼리 실행
```javascript
// 질문, 답변, 이미지를 병렬로 조회
const [answers, images] = await Promise.all([
    getAnswers(questionId),
    getImages(questionId)
]);
```

**성능 향상**: 3개 순차 쿼리 → 병렬 실행으로 **2~3배 빠름**

### 3. 인덱싱 전략
- **Primary Key**: AUTO_INCREMENT로 빠른 삽입
- **Foreign Key**: JOIN 성능 향상
- **Compound Index**: `(entity_type, entity_id)`
- **Full-text Index**: 검색 기능 (향후 확장)

### 4. 트랜잭션
```javascript
BEGIN TRANSACTION
  INSERT question
  INSERT images
COMMIT
```

**데이터 무결성**: 질문과 이미지가 원자적으로 저장

## 🔒 보안 아키텍처

### 1. 인증 & 인가
- **OAuth 2.0**: Google 신뢰 기반 인증
- **세션**: HttpOnly, Secure 쿠키
- **CSRF**: SameSite 쿠키 설정

### 2. SQL Injection 방지
```javascript
// ❌ 취약한 코드
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// ✅ 안전한 코드 (Prepared Statement)
db.execute('SELECT * FROM users WHERE id = ?', [userId]);
```

### 3. XSS 방지
```javascript
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => map[m]);
}
```

### 4. 파일 업로드 보안
- **파일 타입 검증**: MIME type + 확장자
- **파일 크기 제한**: 5MB
- **파일명 무작위화**: timestamp + random

## 📈 확장성 고려사항

### 수평 확장 (Horizontal Scaling)
```
Load Balancer
    ├─ EC2 Instance 1
    ├─ EC2 Instance 2
    └─ EC2 Instance 3
         ↓
    RDS Read Replica
```

### 캐싱 전략 (Redis 추가 시)
```javascript
// 랭킹 캐싱 (5분)
const rankings = await cache.get('rankings') 
    || await Database.getTopRankings();
```

### CDN (CloudFront)
- 정적 파일 (CSS, JS, 이미지)
- 전 세계 엣지 로케이션 배포

### 데이터베이스 샤딩
```
Users 0-100K   → Shard 1
Users 100K-200K → Shard 2
Users 200K+     → Shard 3
```

## 🔧 유지보수성

### 모듈화 구조
```
server.js          # 라우팅, 미들웨어
database/
  connection.js    # 연결 관리
  queries.js       # 비즈니스 로직
```

### 환경 변수 분리
- 개발: `.env`
- 프로덕션: AWS Secrets Manager

### 로깅 전략
```javascript
console.log('✅ 성공')
console.error('❌ 오류:', error)
```

프로덕션: Winston 또는 CloudWatch Logs

## 📊 모니터링 지표

### 핵심 지표
- **응답 시간**: < 200ms (목표)
- **에러율**: < 0.1%
- **가용성**: 99.9%
- **동시 접속**: 100+ users

### 모니터링 도구
- **PM2**: 프로세스 모니터링
- **AWS CloudWatch**: 서버 메트릭
- **RDS Performance Insights**: DB 성능

## 🚀 배포 파이프라인

```
Git Push
    ↓
GitHub Actions (CI/CD)
    ├─ Lint 검사
    ├─ 테스트 실행
    └─ 빌드
    ↓
AWS CodeDeploy
    ↓
EC2 Instance
    ├─ git pull
    ├─ npm install
    ├─ pm2 restart
    └─ health check
```

## 💰 비용 최적화

### AWS 프리 티어
- EC2 t2.micro: 750시간/월
- RDS db.t3.micro: 750시간/월
- 스토리지: 30GB
- 데이터 전송: 15GB/월

### 예상 비용 (프리 티어 이후)
- EC2 t2.micro: $10/월
- RDS db.t3.micro: $15/월
- 총합: **$25/월**

### 비용 절감 팁
- Reserved Instances (1년 약정)
- Auto Scaling (트래픽에 따라)
- S3 Lifecycle 정책 (오래된 이미지 삭제)

