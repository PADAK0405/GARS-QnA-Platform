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
      <head><title>GARS AWS 氚绊彫 ?标车!</title></head>
      <body>
        <h1>?帀 GARS臧� AWS?愳劀 ?标车?侅溂搿??ろ枆 欷戩瀰?堧嫟!</h1>
        <p>氚绊彫 ?滉皠: ${new Date().toLocaleString()}</p>
        <p>?滊矂 ?來儨: ?曥儊</p>
        <p>?れ潓 ?硠: ?れ牅 GARS ?犿攲毽??挫厴???呺?滍晿?胳殧.</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('?滊矂臧� ?姼 ' + PORT + '?愳劀 ?ろ枆 欷戩瀰?堧嫟.');
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

echo 'GARS ?れ箻 ?勲!'
