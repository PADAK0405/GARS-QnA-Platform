/**
 * MySQL 연결 풀 설정
 * - Connection Pooling을 통한 메모리 효율성
 * - 자동 재연결 및 에러 핸들링
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Connection Pool 생성 (메모리 효율적)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qna_hub',
    
    // Connection Pool 설정
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
    
    // 성능 최적화
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    
    // 타임아웃 설정
    connectTimeout: 10000,
    
    // 문자 인코딩
    charset: 'utf8mb4',
    
    // 타임존 설정
    timezone: '+09:00',
    
    // 날짜를 문자열로 반환하지 않음
    dateStrings: false,
});

// 연결 테스트 및 에러 핸들링
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL 데이터베이스 연결 성공!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL 연결 실패:', err.message);
        console.error('📋 연결 정보를 확인하세요:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });
    });

// Pool 에러 핸들링
pool.on('error', (err) => {
    console.error('MySQL Pool Error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('데이터베이스 연결이 끊어졌습니다.');
    }
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\n서버 종료 중... 데이터베이스 연결을 정리합니다.');
    await pool.end();
    process.exit(0);
});

module.exports = pool;

