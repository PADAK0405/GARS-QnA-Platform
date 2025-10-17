# 📱 Google OAuth 설정 가이드

## 1️⃣ Google Cloud Console 설정

### Step 1: 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 프로젝트 이름: `QnA Hub` (원하는 이름)

### Step 2: OAuth 동의 화면 구성
1. 왼쪽 메뉴 → **API 및 서비스** → **OAuth 동의 화면**
2. **User Type**: 외부(External) 선택
3. 앱 정보 입력:
   - **앱 이름**: QnA Hub
   - **사용자 지원 이메일**: 본인 이메일
   - **개발자 연락처 정보**: 본인 이메일
4. **범위 추가 또는 삭제** → 기본 범위만 사용 (profile)
5. **저장 후 계속**

### Step 3: OAuth 2.0 클라이언트 ID 생성
1. 왼쪽 메뉴 → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름: `QnA Hub Web Client`
5. **승인된 자바스크립트 원본** 추가:
   ```
   http://localhost:3000
   https://yourdomain.com  (프로덕션)
   ```
6. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:3000/auth/google/callback
   https://yourdomain.com/auth/google/callback  (프로덕션)
   ```
7. **만들기** 클릭

### Step 4: 클라이언트 ID 및 비밀번호 복사
- **클라이언트 ID**: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
- **클라이언트 보안 비밀**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxx`

⚠️ **중요**: 이 정보는 안전하게 보관하세요!

---

## 2️⃣ 프로젝트 환경 변수 설정

### `.env` 파일에 추가
```env
GOOGLE_CLIENT_ID=여기에_클라이언트_ID_붙여넣기
GOOGLE_CLIENT_SECRET=여기에_클라이언트_보안_비밀_붙여넣기
CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 프로덕션 환경 (AWS 배포 시)
```env
GOOGLE_CLIENT_ID=동일한_클라이언트_ID
GOOGLE_CLIENT_SECRET=동일한_클라이언트_보안_비밀
CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

---

## 3️⃣ 테스트

### 로컬 테스트
1. 서버 실행:
   ```bash
   node server.js
   ```

2. 브라우저에서 접속:
   ```
   http://localhost:3000
   ```

3. "Google로 로그인" 버튼 클릭

4. Google 계정 선택 후 로그인

### 성공 확인
✅ 로그인 후 사용자 이름이 표시됨  
✅ 질문하기 버튼 활성화  
✅ 로그아웃 버튼 표시  

---

## 🔧 문제 해결

### 에러: redirect_uri_mismatch
- Google Console에서 리디렉션 URI가 정확히 일치하는지 확인
- `http://` vs `https://` 확인
- 포트 번호 확인 (3000)

### 에러: invalid_client
- `.env` 파일의 클라이언트 ID와 비밀번호 확인
- 따옴표 없이 순수 값만 입력했는지 확인

### 로그인 후 오류
- 데이터베이스 연결 확인
- MySQL 서버 실행 여부 확인
- 테이블 생성 여부 확인

---

## 🚀 프로덕션 체크리스트

- [ ] Google OAuth 동의 화면 "프로덕션" 상태로 변경
- [ ] HTTPS 도메인으로 리디렉션 URI 설정
- [ ] 환경 변수를 AWS Secrets Manager에 저장
- [ ] SESSION_SECRET 강력한 랜덤 문자열로 변경
- [ ] cookie.secure = true (HTTPS에서만 쿠키 전송)

