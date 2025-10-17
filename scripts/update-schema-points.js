/**
 * 포인트 컬럼 추가 스크립트
 * 서버 시작 시 자동으로 실행됩니다.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchemaForPoints() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
        queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0')
    });

    let connection;
    try {
        connection = await pool.getConnection();
        console.log('🔍 포인트 시스템 스키마 확인 중...');

        // points 컬럼 존재 여부 확인
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'points'
        `);

        if (columns.length === 0) {
            console.log('📝 points 컬럼 추가 중...');
            
            // points 컬럼 추가
            await connection.execute(`
                ALTER TABLE users
                ADD COLUMN points INT DEFAULT 0 AFTER experience
            `);
            
            console.log('✅ points 컬럼 추가 완료');
            
            // points 인덱스 추가
            await connection.execute(`
                ALTER TABLE users
                ADD INDEX idx_points (points DESC)
            `);
            
            console.log('✅ points 인덱스 추가 완료');
            
            // 기존 사용자들의 points를 0으로 초기화
            await connection.execute(`
                UPDATE users 
                SET points = 0 
                WHERE points IS NULL
            `);
            
            console.log('✅ 기존 사용자 포인트 초기화 완료');
        } else {
            console.log('✅ points 컬럼이 이미 존재합니다');
        }

    } catch (error) {
        console.error('❌ 포인트 스키마 업데이트 실패:', error);
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

module.exports = updateSchemaForPoints;

// 직접 실행 시
if (require.main === module) {
    updateSchemaForPoints()
        .then(() => {
            console.log('🎉 포인트 시스템 스키마 업데이트 완료!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 스크립트 실행 실패:', error);
            process.exit(1);
        });
}
