# 🔧 AWS 배포 문제 해결 가이드

> **배포 중 문제가 발생했나요?**  
> 이 가이드에서 해결책을 찾아보세요!

## 🚨 긴급 문제 해결

### ❌ 배포가 시작되지 않는 경우

#### **문제**: "AWS CLI가 설치되어 있지 않습니다"
```bash
# Windows 해결방법
# 1. https://aws.amazon.com/cli/ 접속
# 2. "AWS CLI MSI installer for Windows (64-bit)" 다운로드
# 3. 설치 후 명령 프롬프트 재시작

# 설치 확인
aws --version
```

#### **문제**: "AWS 자격 증명이 설정되어 있지 않습니다"
```bash
# 해결방법
aws configure

# 입력할 정보
AWS Access Key ID: [AWS 콘솔에서 복사]
AWS Secret Access Key: [AWS 콘솔에서 복사]
Default region name: ap-northeast-2
Default output format: json
```

#### **문제**: "키 페어를 찾을 수 없습니다"
```bash
# 해결방법 1: AWS 콘솔에서 생성
# 1. https://console.aws.amazon.com/ec2/ 접속
# 2. "키 페어" → "키 페어 생성"
# 3. 이름: gars-keypair, 형식: .pem

# 해결방법 2: 명령어로 생성
aws ec2 create-key-pair --key-name gars-keypair --query 'KeyMaterial' --output text > gars-keypair.pem
```

---

## 🌐 웹사이트 접속 문제

### ❌ 웹사이트에 접속할 수 없는 경우

#### **1단계: EC2 인스턴스 상태 확인**
```bash
# AWS 콘솔에서 확인
# 1. https://console.aws.amazon.com/ec2/ 접속
# 2. "인스턴스" 메뉴 클릭
# 3. gars-stack-xxx 인스턴스 상태가 "실행 중"인지 확인
```

#### **2단계: 보안 그룹 확인**
```bash
# 보안 그룹 설정 확인
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

# 필요한 포트들
# - 22 (SSH)
# - 80 (HTTP)
# - 443 (HTTPS)
# - 3000 (Node.js)
```

#### **3단계: 서버 상태 확인**
```bash
# SSH로 서버 접속
ssh -i gars-keypair.pem ec2-user@[EC2-IP주소]

# 서버 접속 후 실행
pm2 status          # 애플리케이션 상태
pm2 logs gars-app   # 애플리케이션 로그
sudo systemctl status nginx  # 웹 서버 상태
```

#### **4단계: 방화벽 확인**
```bash
# Windows 방화벽 설정
# 1. Windows 설정 → 네트워크 및 인터넷 → Windows Defender 방화벽
# 2. "앱 또는 기능이 Windows Defender 방화벽을 통과하도록 허용"
# 3. PowerShell, 명령 프롬프트 허용
```

### ❌ 특정 페이지에 접속할 수 없는 경우

#### **관리자 페이지 접속 불가**
```bash
# 해결방법
# 1. URL 확인: http://[IP주소]/admin.html
# 2. 로그인 상태 확인
# 3. 관리자 권한 확인
```

#### **AI 질문 페이지 접속 불가**
```bash
# 해결방법
# 1. Gemini API 키 확인
# 2. 환경 변수 설정 확인
# 3. 로그인 상태 확인
```

---

## 🗄️ 데이터베이스 문제

### ❌ 데이터베이스 연결 오류

#### **문제**: "데이터베이스 연결 실패"
```bash
# 1단계: RDS 상태 확인
aws rds describe-db-instances --db-instance-identifier gars-database

# 2단계: 보안 그룹 확인
# RDS 보안 그룹에서 EC2 보안 그룹으로부터 3306 포트 접속 허용

# 3단계: 연결 테스트
mysql -h [RDS-엔드포인트] -u admin -p qna_hub
```

#### **문제**: "데이터 마이그레이션 실패"
```bash
# 해결방법
# 1. 로컬 데이터베이스 백업
mysqldump -u root -p qna_hub > gars_backup.sql

# 2. AWS RDS로 복원
mysql -h [RDS-엔드포인트] -u admin -p qna_hub < gars_backup.sql

# 3. 마이그레이션 스크립트 실행
npm run db:migrate
```

### ❌ 데이터 손실 문제

#### **문제**: "데이터가 보이지 않습니다"
```bash
# 해결방법
# 1. 데이터베이스 연결 확인
# 2. 테이블 존재 확인
mysql -h [RDS-엔드포인트] -u admin -p qna_hub -e "SHOW TABLES;"

# 3. 데이터 개수 확인
mysql -h [RDS-엔드포인트] -u admin -p qna_hub -e "SELECT COUNT(*) FROM users;"
```

---

## 🔐 인증 및 보안 문제

### ❌ Google 로그인 오류

#### **문제**: "Google 로그인이 작동하지 않습니다"
```bash
# 해결방법
# 1. Google OAuth 설정 확인
# 2. 리디렉션 URI 추가
#   - http://[IP주소]/auth/google/callback
#   - http://[도메인]/auth/google/callback

# 3. 환경 변수 확인
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
```

#### **문제**: "세션이 유지되지 않습니다"
```bash
# 해결방법
# 1. SESSION_SECRET 확인
# 2. 세션 설정 확인
# 3. 쿠키 설정 확인
```

### ❌ CSRF 토큰 오류

#### **문제**: "CSRF 토큰이 유효하지 않습니다"
```bash
# 해결방법
# 1. csrf.js 파일 확인
# 2. CSRF 토큰 생성 확인
# 3. 요청 헤더 확인
```

---

## 📁 파일 업로드 문제

### ❌ 이미지 업로드 오류

#### **문제**: "파일을 업로드할 수 없습니다"
```bash
# 해결방법
# 1. S3 버킷 권한 확인
aws s3 ls s3://[버킷명]/

# 2. 파일 크기 제한 확인
# 3. 파일 형식 확인
# 4. 업로드 디렉토리 권한 확인
```

#### **문제**: "업로드된 이미지가 보이지 않습니다"
```bash
# 해결방법
# 1. S3 버킷 퍼블릭 읽기 권한 확인
# 2. CloudFront 설정 확인
# 3. 파일 경로 확인
```

---

## ⚡ 성능 문제

### ❌ 웹사이트가 느린 경우

#### **해결방법 1: CloudFront 캐싱 설정**
```bash
# CloudFront 콘솔에서
# 1. 캐싱 정책 조정
# 2. TTL 값 조정
# 3. 압축 활성화
```

#### **해결방법 2: 데이터베이스 최적화**
```bash
# 1. 인덱스 추가
# 2. 쿼리 최적화
# 3. 연결 풀 설정
```

#### **해결방법 3: 서버 리소스 확인**
```bash
# EC2 서버 접속 후
top                    # CPU 사용률 확인
free -h               # 메모리 사용률 확인
df -h                 # 디스크 사용률 확인
```

---

## 🔄 업데이트 및 배포 문제

### ❌ 코드 업데이트가 반영되지 않는 경우

#### **해결방법**
```bash
# 1. EC2 서버 접속
ssh -i gars-keypair.pem ec2-user@[IP주소]

# 2. 코드 업데이트
cd /home/ec2-user/gars
git pull origin main

# 3. 의존성 설치
npm install

# 4. 애플리케이션 재시작
pm2 restart gars-app

# 5. Nginx 재시작
sudo systemctl reload nginx
```

### ❌ 배포 스크립트 오류

#### **문제**: "CloudFormation 스택 생성 실패"
```bash
# 해결방법
# 1. AWS 콘솔에서 CloudFormation 상태 확인
# 2. 이벤트 탭에서 오류 메시지 확인
# 3. 실패한 리소스 확인
# 4. 스택 삭제 후 재생성
```

---

## 📊 모니터링 및 로그

### 🔍 로그 확인 방법

#### **애플리케이션 로그**
```bash
# 실시간 로그 확인
pm2 logs gars-app --follow

# 특정 시간대 로그
pm2 logs gars-app --lines 100
```

#### **웹 서버 로그**
```bash
# Nginx 액세스 로그
sudo tail -f /var/log/nginx/access.log

# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log
```

#### **시스템 로그**
```bash
# 시스템 로그
sudo tail -f /var/log/messages

# 보안 로그
sudo tail -f /var/log/secure
```

### 📈 성능 모니터링

#### **AWS CloudWatch**
```bash
# CloudWatch 메트릭 확인
aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value=i-1234567890abcdef0 \
    --start-time 2023-01-01T00:00:00Z \
    --end-time 2023-01-01T23:59:59Z \
    --period 3600 \
    --statistics Average
```

---

## 🆘 긴급 복구 방법

### 💥 전체 시스템 복구

#### **1단계: 백업 확인**
```bash
# RDS 스냅샷 확인
aws rds describe-db-snapshots --db-instance-identifier gars-database

# S3 버킷 백업 확인
aws s3 ls s3://[버킷명]/
```

#### **2단계: 새 인스턴스 생성**
```bash
# CloudFormation 스택 재생성
aws cloudformation delete-stack --stack-name gars-stack
aws cloudformation wait stack-delete-complete --stack-name gars-stack
aws cloudformation create-stack --stack-name gars-stack --template-body file://aws-deploy.yml
```

#### **3단계: 데이터 복원**
```bash
# RDS 스냅샷에서 복원
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier gars-database-restored \
    --db-snapshot-identifier gars-database-snapshot
```

---

## 📞 추가 지원

### 🆘 문제가 해결되지 않는 경우

1. **AWS 지원 센터**: [console.aws.amazon.com/support](https://console.aws.amazon.com/support/)
2. **AWS 문서**: [docs.aws.amazon.com](https://docs.aws.amazon.com/)
3. **Stack Overflow**: [stackoverflow.com](https://stackoverflow.com/) (태그: aws, nodejs, mysql)
4. **GitHub Issues**: 프로젝트 저장소의 Issues 탭

### 📚 유용한 명령어 모음

```bash
# 서버 상태 확인
pm2 status
pm2 logs gars-app
sudo systemctl status nginx
sudo systemctl status mysql

# 데이터베이스 확인
mysql -h [RDS-엔드포인트] -u admin -p qna_hub -e "SHOW TABLES;"

# 파일 권한 확인
ls -la /home/ec2-user/gars/
ls -la /var/www/html/

# 네트워크 확인
netstat -tlnp | grep :3000
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# 디스크 사용량 확인
df -h
du -sh /home/ec2-user/gars/

# 메모리 사용량 확인
free -h
top
```

---

**🎯 이 가이드로 대부분의 문제를 해결할 수 있습니다!**  
문제가 지속되면 AWS 지원 센터에 문의하세요.
