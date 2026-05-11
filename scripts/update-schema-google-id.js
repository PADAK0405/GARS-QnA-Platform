/**
 * Google OAuth ID 컬럼 추가 스크립트
 * 서버 시작 시 자동으로 실행됩니다.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchemaForGoogleId() {
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
        console.log('🔍 Google OAuth ID 스키마 확인 중...');

        // google_id 컬럼 존재 여부 확인
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'users'
            AND COLUMN_NAME = 'google_id'
        `);

        if (columns.length === 0) {
            console.log('📝 google_id 컬럼 추가 중...');

            // google_id 컬럼 추가
            await connection.execute(`
                ALTER TABLE users
                ADD COLUMN google_id VARCHAR(255) UNIQUE AFTER id
            `);

            console.log('✅ google_id 컬럼 추가 완료');

            // google_id 인덱스 추가
            await connection.execute(`
                ALTER TABLE users
                ADD INDEX idx_google_id (google_id)
            `);

            console.log('✅ google_id 인덱스 추가 완료');

            // 기존 id 값들을 google_id로 복사
            await connection.execute(`
                UPDATE users
                SET google_id = id
                WHERE google_id IS NULL
            `);

            console.log('✅ 기존 사용자 Google ID 복사 완료');

            // id 컬럼을 AUTO_INCREMENT INT로 변경하기 위한 임시 작업
            console.log('📝 id 컬럼 구조 변경 준비 중...');

            // 새로운 AUTO_INCREMENT id 컬럼 생성
            await connection.execute(`
                ALTER TABLE users
                ADD COLUMN new_id INT AUTO_INCREMENT PRIMARY KEY FIRST
            `);

            console.log('✅ 새로운 AUTO_INCREMENT id 컬럼 생성 완료');

            // 기존 외래키 관계들을 새로운 id로 업데이트
            await connection.execute(`
                UPDATE questions SET user_id = (
                    SELECT new_id FROM users WHERE google_id = questions.user_id
                ) WHERE user_id IN (SELECT google_id FROM users)
            `);

            await connection.execute(`
                UPDATE answers SET user_id = (
                    SELECT new_id FROM users WHERE google_id = answers.user_id
                ) WHERE user_id IN (SELECT google_id FROM users)
            `);

            await connection.execute(`
                UPDATE reports SET reporter_id = (
                    SELECT new_id FROM users WHERE google_id = reports.reporter_id
                ) WHERE reporter_id IN (SELECT google_id FROM users)
            `);

            await connection.execute(`
                UPDATE reports SET reviewed_by = (
                    SELECT new_id FROM users WHERE google_id = reports.reviewed_by
                ) WHERE reviewed_by IN (SELECT google_id FROM users)
            `);

            console.log('✅ 외래키 관계 업데이트 완료');

            // 기존 id 컬럼 삭제 및 new_id를 id로 변경
            await connection.execute(`ALTER TABLE users DROP COLUMN id`);
            await connection.execute(`ALTER TABLE users CHANGE new_id id INT AUTO_INCREMENT PRIMARY KEY`);

            console.log('✅ id 컬럼 구조 변경 완료');

        } else {
            console.log('✅ google_id 컬럼이 이미 존재합니다');
        }

    } catch (error) {
        console.error('❌ Google OAuth ID 스키마 업데이트 실패:', error);
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

module.exports = updateSchemaForGoogleId;

// 직접 실행 시
if (require.main === module) {
    updateSchemaForGoogleId()
        .then(() => {
            console.log('🎉 Google OAuth ID 스키마 업데이트 완료!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 스크립트 실행 실패:', error);
            process.exit(1);
        });
}