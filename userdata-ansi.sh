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
      <head><title>GARS AWS 배포 ?�공!</title></head>
      <body>
        <h1>?�� GARS가 AWS?�서 ?�공?�으�??�행 중입?�다!</h1>
        <p>배포 ?�간: ${new Date().toLocaleString()}</p>
        <p>?�버 ?�태: ?�상</p>
        <p>?�음 ?�계: ?�제 GARS ?�플리�??�션???�로?�하?�요.</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('?�버가 ?�트 ' + PORT + '?�서 ?�행 중입?�다.');
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

echo 'GARS ?�치 ?�료!'
