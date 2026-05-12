# 데이터베이스 스키마 동기화 완료 보고서

## 📋 작업 개요

**목표**: 코드와 실제 Railway MySQL 스키마 불일치로 인한 런타임 에러 해결

**작업 일자**: 2026년 5월 12일

**작업 방식**: 
- 기존 데이터 보존 (절대 삭제 금지)
- ALTER TABLE / CREATE TABLE IF NOT EXISTS 방식만 사용
- 자동 마이그레이션 시스템 구축

---

## 🔍 발견된 문제점

### 1. 발생한 에러들

```
❌ Unknown column 'suspended_until' in 'field list'
❌ Unknown column 'updated_at' in 'field list'
❌ Table 'reports' doesn't exist
❌ images, answers, admin_logs 등의 테이블 누락
```

### 2. 근본 원인

- **schema.sql은 완전하지만, 실제 Railway DB에 적용되지 않음**
- 수동 마이그레이션 누락으로 신규 기능 추가 시 DB 구조 미반영
- 서버 재배포 시 스키마 동기화 자동화 부재

---

## ✅ 구현된 솔루션

### 1. 자동 마이그레이션 시스템 (`database/auto-migrate.js`)

서버 시작 시 자동으로 실행되는 마이그레이션 시스템을 구축했습니다.

**주요 기능:**
- ✅ 필수 테이블 자동 생성 (CREATE TABLE IF NOT EXISTS)
- ✅ 누락된 컬럼 자동 추가 (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- ✅ 인덱스 자동 생성
- ✅ 타입 정합성 보장 (users.id = INT, 외래키 타입 통일)
- ✅ 기존 데이터 보존 보장

**처리 테이블 목록:**
1. `users` - 사용자 정보
2. `questions` - 질문
3. `answers` - 답변
4. `images` - 이미지
5. `sessions` - 세션
6. `admin_logs` - 관리자 로그
7. `reports` - 신고
8. `calendar_events` - 캘린더 이벤트
9. `dormitory_students` - 기숙사생 정보
10. `leave_requests` - 외출/외박 신청
11. `dormitory_points` - 벌점/상점
12. `dormitory_violations` - 위반 기록

### 2. server.js 통합

서버 시작 시 마이그레이션이 **최우선**으로 실행됩니다:

```javascript
async function initializeServer() {
    console.log('🚀 서버 초기화 시작');
    
    try {
        // 0. 자동 마이그레이션 실행 (최우선)
        console.log('📊 자동 데이터베이스 마이그레이션 실행 중...');
        const migrationResult = await DatabaseMigration.runMigrations();
        if (!migrationResult.success) {
            throw new Error(`마이그레이션 실패: ${migrationResult.error}`);
        }
        
        // ... 나머지 초기화 작업
    }
}
```

---

## 📊 현재 코드가 요구하는 전체 DB 구조

### users 테이블
```sql
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    username VARCHAR(255),
    password VARCHAR(255),
    login_provider ENUM('local', 'google', 'system') DEFAULT 'google',
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    score INT DEFAULT 0,
    level INT DEFAULT 1,
    experience INT DEFAULT 0,
    points INT DEFAULT 0,
    status_message VARCHAR(200) DEFAULT NULL,
    role ENUM('user', 'moderator', 'admin', 'super_admin') DEFAULT 'user',
    status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
    suspended_until TIMESTAMP NULL,           -- ✅ 추가됨
    suspended_at TIMESTAMP NULL,              -- ✅ 추가됨
    suspension_reason TEXT NULL,              -- ✅ 추가됨
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  -- ✅ 추가됨
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**추가된 컬럼 (users):**
- ✅ `suspended_until` - 정지 해제 일시
- ✅ `suspended_at` - 정지 시작 일시
- ✅ `suspension_reason` - 정지 사유
- ✅ `updated_at` - 최종 수정 일시
- ✅ `status_message` - 상태 메시지

### questions 테이블
```sql
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    views INT DEFAULT 0,
    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
    hidden_by INT NULL,
    hidden_reason TEXT NULL,
    hidden_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- ✅ 추가됨
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**추가된 컬럼 (questions):**
- ✅ `updated_at` - 최종 수정 일시

### answers 테이블
```sql
CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
    hidden_by INT NULL,
    hidden_reason TEXT NULL,
    hidden_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- ✅ 추가됨
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**추가된 컬럼 (answers):**
- ✅ `updated_at` - 최종 수정 일시

### reports 테이블 (신규 생성)
```sql
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    target_type ENUM('question', 'answer', 'user') NOT NULL,
    target_id INT NOT NULL,
    reason ENUM('spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other') NOT NULL,
    description TEXT,
    status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**신규 테이블:**
- ✅ `reports` - 신고 시스템

### images 테이블
```sql
CREATE TABLE IF NOT EXISTS images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    entity_type ENUM('question', 'answer') NOT NULL,
    entity_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**신규 테이블:**
- ✅ `images` - 이미지 관리

### admin_logs 테이블
```sql
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action_type ENUM('user_suspend', 'user_ban', 'user_unban', 'question_hide', 'question_restore', 'answer_hide', 'answer_restore', 'role_change', 'content_delete', 'server_initialize', 'server_initialize_failed') NOT NULL,
    target_type ENUM('user', 'question', 'answer', 'system') NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    reason TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**신규 테이블:**
- ✅ `admin_logs` - 관리자 로그

### sessions 테이블
```sql
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**신규 테이블:**
- ✅ `sessions` - 세션 관리

---

## 🔧 추가된 인덱스

성능 최적화를 위해 다음 인덱스가 자동으로 생성됩니다:

```sql
-- users 테이블 인덱스
CREATE INDEX idx_score ON users(score DESC);
CREATE INDEX idx_level ON users(level DESC);
CREATE INDEX idx_role ON users(role);
CREATE INDEX idx_status ON users(status);

-- questions 테이블 인덱스
CREATE INDEX idx_user_id ON questions(user_id);
CREATE INDEX idx_created_at ON questions(created_at DESC);

-- answers 테이블 인덱스
CREATE INDEX idx_question_id ON answers(question_id);
CREATE INDEX idx_user_id ON answers(user_id);

-- images 테이블 인덱스
CREATE INDEX idx_entity ON images(entity_type, entity_id);

-- admin_logs 테이블 인덱스
CREATE INDEX idx_admin_id ON admin_logs(admin_id);

-- reports 테이블 인덱스
CREATE INDEX idx_reporter_id ON reports(reporter_id);
CREATE INDEX idx_target ON reports(target_type, target_id);
CREATE INDEX idx_status ON reports(status);
```

---

## 🚀 자동 마이그레이션 실행 로그 예시

서버 시작 시 다음과 같은 로그가 출력됩니다:

```
🚀 서버 초기화 시작
📊 자동 데이터베이스 마이그레이션 실행 중...
🔧 데이터베이스 마이그레이션 시작...
📦 필수 테이블 생성 중...
✓ users 테이블 확인/생성 완료
✓ questions 테이블 확인/생성 완료
✓ answers 테이블 확인/생성 완료
✓ images 테이블 확인/생성 완료
✓ sessions 테이블 확인/생성 완료
✓ admin_logs 테이블 확인/생성 완료
✓ reports 테이블 확인/생성 완료
✓ calendar_events 테이블 확인/생성 완료
✓ dormitory_students 테이블 확인/생성 완료
✓ leave_requests 테이블 확인/생성 완료
✓ dormitory_points 테이블 확인/생성 완료
✓ dormitory_violations 테이블 확인/생성 완료
👤 users 테이블 마이그레이션 중...
  ✓ suspended_until 컬럼 추가됨
  ✓ suspended_at 컬럼 추가됨
  ✓ suspension_reason 컬럼 추가됨
  ✓ updated_at 컬럼 추가됨
  ✓ status_message 컬럼 추가됨
✓ users 테이블 마이그레이션 완료
❓ questions 테이블 마이그레이션 중...
  ✓ updated_at 컬럼 추가됨
✓ questions 테이블 마이그레이션 완료
💬 answers 테이블 마이그레이션 중...
  ✓ updated_at 컬럼 추가됨
✓ answers 테이블 마이그레이션 완료
📇 인덱스 추가 중...
  ✓ users.idx_score 인덱스 추가됨
  ✓ users.idx_level 인덱스 추가됨
  ✓ users.idx_role 인덱스 추가됨
  ✓ users.idx_status 인덱스 추가됨
  ✓ questions.idx_user_id 인덱스 추가됨
  ✓ questions.idx_created_at 인덱스 추가됨
  ✓ answers.idx_question_id 인덱스 추가됨
  ✓ answers.idx_user_id 인덱스 추가됨
  ✓ images.idx_entity 인덱스 추가됨
  ✓ admin_logs.idx_admin_id 인덱스 추가됨
  ✓ reports.idx_reporter_id 인덱스 추가됨
  ✓ reports.idx_target 인덱스 추가됨
  ✓ reports.idx_status 인덱스 추가됨
✓ 인덱스 추가 완료
✅ 데이터베이스 마이그레이션 완료!
```

---

## 📝 Railway에서 실행할 SQL (필요 시)

자동 마이그레이션이 실패하거나 수동으로 실행해야 하는 경우, 다음 SQL을 Railway MySQL 콘솔에서 직접 실행할 수 있습니다:

### Option 1: 전체 스키마 재생성 (데이터 백업 필수!)

```sql
-- 주의: 기존 데이터가 모두 삭제됩니다!
-- 반드시 백업 후 실행하세요!

DROP DATABASE IF EXISTS qna_hub;
CREATE DATABASE qna_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qna_hub;

-- 이후 database/schema.sql의 전체 내용을 실행
```

### Option 2: 누락된 컬럼만 추가 (안전)

```sql
-- users 테이블 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message VARCHAR(200) DEFAULT NULL;

-- questions 테이블 컬럼 추가
ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- answers 테이블 컬럼 추가
ALTER TABLE answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- reports 테이블 생성
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    target_type ENUM('question', 'answer', 'user') NOT NULL,
    target_id INT NOT NULL,
    reason ENUM('spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other') NOT NULL,
    description TEXT,
    status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_reporter_id (reporter_id),
    INDEX idx_target (target_type, target_id),
    INDEX idx_status (status),
    UNIQUE KEY unique_user_report (reporter_id, target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- images 테이블 생성
CREATE TABLE IF NOT EXISTS images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    entity_type ENUM('question', 'answer') NOT NULL,
    entity_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- admin_logs 테이블 생성
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action_type ENUM('user_suspend', 'user_ban', 'user_unban', 'question_hide', 'question_restore', 'answer_hide', 'answer_restore', 'role_change', 'content_delete', 'server_initialize', 'server_initialize_failed') NOT NULL,
    target_type ENUM('user', 'question', 'answer', 'system') NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    reason TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## ✅ 타입 정합성 보장

### users.id는 반드시 INT AUTO_INCREMENT PRIMARY KEY

모든 외래키가 올바르게 INT 타입을 참조하도록 보장되었습니다:

```sql
-- ✅ 올바른 타입 정합성
users.id                    INT (PRIMARY KEY)
├─ questions.user_id        INT (FOREIGN KEY)
├─ answers.user_id          INT (FOREIGN KEY)
├─ admin_logs.admin_id      INT (FOREIGN KEY)
├─ reports.reporter_id      INT (FOREIGN KEY)
└─ reports.reviewed_by      INT (FOREIGN KEY)
```

**절대 금지:**
- ❌ users.id를 VARCHAR로 변경
- ❌ OAuth ID를 id 컬럼에 직접 저장
- ✅ OAuth ID는 google_id 컬럼(VARCHAR)에만 저장

---

## 🎯 결과 요약

### 추가된 테이블 목록
1. ✅ `reports` - 신고 시스템
2. ✅ `images` - 이미지 관리
3. ✅ `admin_logs` - 관리자 로그
4. ✅ `sessions` - 세션 관리
5. ✅ `calendar_events` - 캘린더
6. ✅ `dormitory_students` - 기숙사생 정보
7. ✅ `leave_requests` - 외출/외박 신청
8. ✅ `dormitory_points` - 벌점/상점
9. ✅ `dormitory_violations` - 위반 기록

### 추가된 컬럼 목록
**users 테이블:**
- ✅ `suspended_until` (TIMESTAMP NULL)
- ✅ `suspended_at` (TIMESTAMP NULL)
- ✅ `suspension_reason` (TEXT NULL)
- ✅ `updated_at` (TIMESTAMP)
- ✅ `status_message` (VARCHAR(200))

**questions 테이블:**
- ✅ `updated_at` (TIMESTAMP)

**answers 테이블:**
- ✅ `updated_at` (TIMESTAMP)

### 수정된 타입 목록
- ✅ users.id = INT (AUTO_INCREMENT, PRIMARY KEY) - 유지
- ✅ 모든 외래키 = INT로 통일

### 자동 마이그레이션 코드
- ✅ `database/auto-migrate.js` 생성
- ✅ `server.js`에 통합 완료
- ✅ 서버 시작 시 자동 실행

---

## 🔒 보안 및 안전성 보장

1. **기존 데이터 보존**
   - DROP TABLE 절대 사용 안 함
   - CREATE TABLE IF NOT EXISTS만 사용
   - ALTER TABLE ADD COLUMN IF NOT EXISTS만 사용

2. **타입 정합성**
   - users.id는 INT AUTO_INCREMENT PRIMARY KEY로 고정
   - 모든 외래키는 INT 타입으로 통일
   - OAuth ID는 google_id (VARCHAR) 컬럼에만 저장

3. **에러 처리**
   - 중복 컬럼/테이블 생성 시도 시 에러 무시
   - 외래키 제약 조건 오류 처리
   - 마이그레이션 실패 시 서버 시작 중단

---

## 🚀 배포 가이드

### 1. Railway 재배포 방법

```bash
# 1. 코드 푸시
git add .
git commit -m "feat: 자동 DB 마이그레이션 시스템 추가"
git push origin main

# 2. Railway에서 자동 재배포됨

# 3. 서버 로그 확인
# Railway 대시보드에서 로그를 확인하여 마이그레이션 성공 여부 확인
```

### 2. 로그 확인 사항

서버 로그에서 다음 메시지를 확인하세요:

```
✅ 데이터베이스 마이그레이션 완료!
✅ MySQL 데이터베이스 연결 성공!
🚀 서버가 http://localhost:3000 에서 실행 중입니다.
```

### 3. 문제 발생 시 대응

마이그레이션이 실패한 경우:

1. Railway MySQL 콘솔에서 수동으로 SQL 실행
2. `docs/DB_MIGRATION_RESULT.md`의 "Railway에서 실행할 SQL" 섹션 참고
3. 서버 재시작

---

## 📌 중요 참고 사항

### 절대 금지 사항
- ❌ OAuth 로직 변경
- ❌ 랭킹 시스템 수정
- ❌ 관리자 권한 로직 수정
- ❌ API 응답 구조 변경
- ❌ 기존 사용자 데이터 삭제
- ❌ users.id를 문자열로 변경
- ❌ 임시 하드코딩

### 향후 개선 사항
- 마이그레이션 버전 관리 시스템 도입
- 롤백 기능 추가
- 마이그레이션 히스토리 로그 테이블 생성

---

## 📞 문의 및 지원

문제가 발생하거나 추가적인 마이그레이션이 필요한 경우:

1. `database/auto-migrate.js` 파일 수정
2. 서버 재시작하여 자동 마이그레이션 실행
3. 또는 Railway MySQL 콘솔에서 수동 SQL 실행

---

**작성자**: AI Assistant  
**최종 수정일**: 2026년 5월 12일  
**문서 버전**: 1.0
