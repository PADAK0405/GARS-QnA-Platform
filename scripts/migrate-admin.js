#!/usr/bin/env node

/**
 * 관리자 기능을 위한 데이터베이스 마이그레이션 스크립트
 * Usage: node scripts/migrate-admin.js
 */

require('dotenv').config();
const Database = require('../database/connection');

async function migrateAdmin() {
    try {
        console.log('🔄 데이터베이스 마이그레이션 시작...');
        
        // users 테이블에 관리자 관련 컬럼 추가
        console.log('📝 users 테이블 업데이트 중...');
        
        try {
            await Database.execute(`
                ALTER TABLE users 
                ADD COLUMN role ENUM('user', 'moderator', 'admin', 'super_admin') DEFAULT 'user'
            `);
            console.log('  ✅ role 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  role 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE users 
                ADD COLUMN status ENUM('active', 'suspended', 'banned') DEFAULT 'active'
            `);
            console.log('  ✅ status 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  status 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE users 
                ADD COLUMN suspended_until TIMESTAMP NULL
            `);
            console.log('  ✅ suspended_until 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  suspended_until 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE users 
                ADD COLUMN suspension_reason TEXT NULL
            `);
            console.log('  ✅ suspension_reason 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  suspension_reason 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        // users 테이블에 인덱스 추가
        try {
            await Database.execute(`CREATE INDEX idx_role ON users (role)`);
            console.log('  ✅ role 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('  ℹ️  role 인덱스가 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`CREATE INDEX idx_status ON users (status)`);
            console.log('  ✅ status 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('  ℹ️  status 인덱스가 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        console.log('✅ users 테이블 업데이트 완료');
        
        // questions 테이블에 상태 관리 컬럼 추가
        console.log('📝 questions 테이블 업데이트 중...');
        
        try {
            await Database.execute(`
                ALTER TABLE questions 
                ADD COLUMN status ENUM('active', 'hidden', 'deleted') DEFAULT 'active'
            `);
            console.log('  ✅ status 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  status 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE questions 
                ADD COLUMN hidden_by VARCHAR(255) NULL
            `);
            console.log('  ✅ hidden_by 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  hidden_by 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE questions 
                ADD COLUMN hidden_reason TEXT NULL
            `);
            console.log('  ✅ hidden_reason 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  hidden_reason 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE questions 
                ADD COLUMN hidden_at TIMESTAMP NULL
            `);
            console.log('  ✅ hidden_at 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  hidden_at 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        // questions 테이블에 인덱스 추가
        try {
            await Database.execute(`CREATE INDEX idx_questions_status ON questions (status)`);
            console.log('  ✅ questions status 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('  ℹ️  questions status 인덱스가 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        console.log('✅ questions 테이블 업데이트 완료');
        
        // answers 테이블에 상태 관리 컬럼 추가
        console.log('📝 answers 테이블 업데이트 중...');
        
        try {
            await Database.execute(`
                ALTER TABLE answers 
                ADD COLUMN status ENUM('active', 'hidden', 'deleted') DEFAULT 'active'
            `);
            console.log('  ✅ status 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  status 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE answers 
                ADD COLUMN hidden_by VARCHAR(255) NULL
            `);
            console.log('  ✅ hidden_by 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  hidden_by 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE answers 
                ADD COLUMN hidden_reason TEXT NULL
            `);
            console.log('  ✅ hidden_reason 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  hidden_reason 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        try {
            await Database.execute(`
                ALTER TABLE answers 
                ADD COLUMN hidden_at TIMESTAMP NULL
            `);
            console.log('  ✅ hidden_at 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('  ℹ️  hidden_at 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        // answers 테이블에 인덱스 추가
        try {
            await Database.execute(`CREATE INDEX idx_answers_status ON answers (status)`);
            console.log('  ✅ answers status 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('  ℹ️  answers status 인덱스가 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        console.log('✅ answers 테이블 업데이트 완료');
        
        // admin_logs 테이블 생성
        console.log('📝 admin_logs 테이블 생성 중...');
        
        await Database.execute(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id VARCHAR(255) NOT NULL,
                action_type ENUM('user_suspend', 'user_ban', 'user_unban', 'question_hide', 'question_restore', 'answer_hide', 'answer_restore', 'role_change', 'content_delete') NOT NULL,
                target_type ENUM('user', 'question', 'answer') NOT NULL,
                target_id VARCHAR(255) NOT NULL,
                reason TEXT,
                details JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_admin_id (admin_id),
                INDEX idx_action_type (action_type),
                INDEX idx_target (target_type, target_id),
                INDEX idx_created_at (created_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log('✅ admin_logs 테이블 생성 완료');
        
        console.log('\n🎉 데이터베이스 마이그레이션 완료!');
        console.log('📋 다음 단계:');
        console.log('   1. node scripts/list-users.js - 사용자 목록 확인');
        console.log('   2. node scripts/make-admin.js <email> admin - 관리자 권한 부여');
        
    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error.message);
        console.error('🔍 오류 상세:', error);
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
migrateAdmin();
