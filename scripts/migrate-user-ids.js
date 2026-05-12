#!/usr/bin/env node

/**
 * 사용자 ID 마이그레이션 스크립트
 * VARCHAR user_id를 INT id로 변경
 * Usage: node scripts/migrate-user-ids.js
 */

require('dotenv').config();
const Database = require('../database/connection');

async function migrateUserIds() {
    try {
        console.log('🔄 사용자 ID 마이그레이션 시작...');

        const pool = Database;

        // 트랜잭션 시작
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. questions 테이블의 user_id를 임시 컬럼으로 백업
            console.log('📋 기존 user_id 백업 중...');
            await connection.execute(`
                ALTER TABLE questions ADD COLUMN old_user_id VARCHAR(255)
            `);

            await connection.execute(`
                UPDATE questions SET old_user_id = user_id
            `);

            // 2. users 테이블에서 google_id로 id 매핑
            console.log('🔗 user_id 매핑 중...');
            await connection.execute(`
                UPDATE questions q
                JOIN users u ON q.old_user_id = u.google_id
                SET q.user_id = u.id
            `);

            // 3. user_id 컬럼 타입 변경
            console.log('🔄 user_id 타입 변경 중...');
            await connection.execute(`
                ALTER TABLE questions MODIFY COLUMN user_id INT NOT NULL
            `);

            // 4. 임시 컬럼 제거
            await connection.execute(`
                ALTER TABLE questions DROP COLUMN old_user_id
            `);

            // answers 테이블도 동일 처리
            console.log('📋 answers 테이블 처리 중...');
            await connection.execute(`
                ALTER TABLE answers ADD COLUMN old_user_id VARCHAR(255)
            `);

            await connection.execute(`
                UPDATE answers SET old_user_id = user_id
            `);

            await connection.execute(`
                UPDATE answers a
                JOIN users u ON a.old_user_id = u.google_id
                SET a.user_id = u.id
            `);

            await connection.execute(`
                ALTER TABLE answers MODIFY COLUMN user_id INT NOT NULL
            `);

            await connection.execute(`
                ALTER TABLE answers DROP COLUMN old_user_id
            `);

            // 기타 테이블들도 처리 (admin_logs 등)
            console.log('📋 admin_logs 테이블 처리 중...');
            await connection.execute(`
                ALTER TABLE admin_logs ADD COLUMN old_admin_id VARCHAR(255)
            `);

            await connection.execute(`
                UPDATE admin_logs SET old_admin_id = admin_id
            `);

            await connection.execute(`
                UPDATE admin_logs al
                JOIN users u ON al.old_admin_id = u.google_id
                SET al.admin_id = u.id
            `);

            await connection.execute(`
                ALTER TABLE admin_logs MODIFY COLUMN admin_id INT NOT NULL
            `);

            await connection.execute(`
                ALTER TABLE admin_logs DROP COLUMN old_admin_id
            `);

            await connection.commit();
            console.log('✅ 사용자 ID 마이그레이션 완료');

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error);
        process.exit(1);
    }
}

migrateUserIds();