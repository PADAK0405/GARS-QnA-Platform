#!/bin/bash
yum update -y
yum install -y nodejs npm git
npm install -g pm2

mkdir -p /home/ec2-user/gars
cd /home/ec2-user/gars

# Create simple Node.js app
cat > server.js << 'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>GARS AWS 배포 성공!</title></head>
      <body>
        <h1>🎉 GARS가 AWS에서 성공적으로 실행 중입니다!</h1>
        <p>배포 시간: ${new Date().toLocaleString()}</p>
        <p>서버 상태: 정상</p>
        <p>다음 단계: 실제 GARS 애플리케이션을 업로드하세요.</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('서버가 포트 ' + PORT + '에서 실행 중입니다.');
});
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "gars-test",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies and start
npm install
pm2 start server.js --name gars-app
pm2 startup
pm2 save

echo 'GARS 설치 완료!'
