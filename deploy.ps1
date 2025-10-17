# GARS AWS 배포 PowerShell 스크립트
Write-Host "🚀 GARS AWS 배포를 시작합니다..." -ForegroundColor Green

# 색상 정의
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

# 함수 정의
function Write-Step {
    param($Message)
    Write-Host "📋 $Message" -ForegroundColor $Blue
}

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor $Green
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor $Red
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Yellow
}

try {
    # 1. AWS CLI 확인
    Write-Step "AWS CLI 설치 확인 중..."
    $awsVersion = aws --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "AWS CLI가 설치되어 있지 않습니다."
        Write-Host "다음 링크에서 AWS CLI를 설치하세요: https://aws.amazon.com/cli/" -ForegroundColor $Yellow
        exit 1
    }
    Write-Success "AWS CLI가 설치되어 있습니다: $awsVersion"

    # 2. AWS 자격 증명 확인
    Write-Step "AWS 자격 증명 확인 중..."
    $awsIdentity = aws sts get-caller-identity 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "AWS 자격 증명이 설정되어 있지 않습니다."
        Write-Host "다음 명령어로 AWS 자격 증명을 설정하세요:" -ForegroundColor $Yellow
        Write-Host "aws configure" -ForegroundColor $Yellow
        exit 1
    }
    Write-Success "AWS 자격 증명이 설정되어 있습니다."

    # 3. 프로젝트 파일 확인
    Write-Step "프로젝트 파일 준비 중..."
    
    if (!(Test-Path ".env")) {
        Write-Warning ".env 파일이 없습니다. 생성합니다..."
        # .env 파일 생성 (사용자가 수동으로 생성해야 함)
        Write-Host "config/env.example.txt 파일을 참고하여 .env 파일을 생성하세요." -ForegroundColor $Yellow
        exit 1
    }
    Write-Success "프로젝트 파일이 준비되었습니다."

    # 4. CloudFormation 스택 배포
    Write-Step "CloudFormation 스택 배포 중..."

    # 스택 이름 설정
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $stackName = "gars-stack-$timestamp"

    Write-Host "스택 이름: $stackName" -ForegroundColor $Yellow

    # CloudFormation 스택 생성
    Write-Host "CloudFormation 스택을 생성하는 중..." -ForegroundColor $Yellow
    $createStackResult = aws cloudformation create-stack `
        --stack-name $stackName `
        --template-body file://aws-deploy.yml `
        --capabilities CAPABILITY_IAM `
        --parameters ParameterKey=KeyName,ParameterValue=gars-keypair `
        --parameters ParameterKey=DatabasePassword,ParameterValue="GarsPassword123!"

    if ($LASTEXITCODE -eq 0) {
        Write-Success "CloudFormation 스택 생성이 시작되었습니다."
        
        # 스택 생성 완료 대기
        Write-Step "스택 생성 완료를 기다리는 중... (약 10-15분 소요)"
        Write-Host "진행 상황을 확인하려면 AWS 콘솔을 방문하세요:" -ForegroundColor $Yellow
        Write-Host "https://console.aws.amazon.com/cloudformation/" -ForegroundColor $Yellow
        
        # 스택 생성 완료 대기
        aws cloudformation wait stack-create-complete --stack-name $stackName
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "스택 생성이 완료되었습니다!"
            
            # 출력 값 가져오기
            Write-Step "배포 정보를 가져오는 중..."
            
            $webServerIP = aws cloudformation describe-stacks `
                --stack-name $stackName `
                --query 'Stacks[0].Outputs[?OutputKey==`WebServerPublicIP`].OutputValue' `
                --output text
            
            $databaseEndpoint = aws cloudformation describe-stacks `
                --stack-name $stackName `
                --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' `
                --output text
            
            $cloudfrontURL = aws cloudformation describe-stacks `
                --stack-name $stackName `
                --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' `
                --output text
            
            $s3Bucket = aws cloudformation describe-stacks `
                --stack-name $stackName `
                --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' `
                --output text
            
            # 배포 정보 출력
            Write-Host ""
            Write-Success "🎉 GARS 배포가 완료되었습니다!"
            Write-Host ""
            Write-Host "📊 배포 정보:" -ForegroundColor $Blue
            Write-Host "  🌐 웹 서버 IP: $webServerIP" -ForegroundColor $Green
            Write-Host "  🗄️  데이터베이스: $databaseEndpoint" -ForegroundColor $Green
            Write-Host "  ☁️  CloudFront URL: http://$cloudfrontURL" -ForegroundColor $Green
            Write-Host "  📦 S3 버킷: $s3Bucket" -ForegroundColor $Green
            Write-Host ""
            Write-Host "🔧 다음 단계:" -ForegroundColor $Blue
            Write-Host "  1. 웹사이트 접속: http://$webServerIP" -ForegroundColor $Yellow
            Write-Host "  2. 관리자 페이지: http://$webServerIP/admin.html" -ForegroundColor $Yellow
            Write-Host "  3. 데이터베이스 마이그레이션: npm run db:migrate" -ForegroundColor $Yellow
            Write-Host ""
            Write-Warning "데이터베이스 마이그레이션을 위해 다음 명령어를 실행하세요:"
            Write-Host "  npm run db:migrate" -ForegroundColor $Yellow
            
        } else {
            Write-Error "스택 생성에 실패했습니다."
            Write-Host "CloudFormation 콘솔에서 오류를 확인하세요:" -ForegroundColor $Yellow
            Write-Host "https://console.aws.amazon.com/cloudformation/" -ForegroundColor $Yellow
            exit 1
        }
    } else {
        Write-Error "CloudFormation 스택 생성에 실패했습니다."
        Write-Host "오류 메시지: $createStackResult" -ForegroundColor $Red
        exit 1
    }

} catch {
    Write-Error "배포 중 오류가 발생했습니다: $($_.Exception.Message)"
    exit 1
}

Write-Success "배포 스크립트가 완료되었습니다!"
