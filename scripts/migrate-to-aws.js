const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// AWS RDS 연결 설정
const awsConfig = {
    host: process.env.AWS_DB_HOST || 'your-rds-endpoint.amazonaws.com',
    user: process.env.AWS_DB_USER || 'admin',
    password: process.env.AWS_DB_PASSWORD || 'your-password',
    database: process.env.AWS_DB_NAME || 'qna_hub',
    ssl: {
        rejectUnauthorized: false
    }
};

// 로컬 XAMPP 연결 설정
const localConfig = {
    host: 'localhost',
    user: 'root',
    password: process.env.LOCAL_DB_PASSWORD || '',
    database: 'qna_hub'
};

async function migrateToAWS() {
    let localConnection, awsConnection;
    
    try {
        console.log('🔄 AWS 마이그레이션을 시작합니다...');
        
        // 1. 로컬 데이터베이스 연결
        console.log('📡 로컬 데이터베이스에 연결 중...');
        localConnection = await mysql.createConnection(localConfig);
        console.log('✅ 로컬 데이터베이스 연결 성공');
        
        // 2. AWS RDS 연결
        console.log('☁️  AWS RDS에 연결 중...');
        awsConnection = await mysql.createConnection(awsConfig);
        console.log('✅ AWS RDS 연결 성공');
        
        // 3. 로컬 데이터 백업
        console.log('💾 로컬 데이터 백업 중...');
        const backupData = await backupLocalData(localConnection);
        console.log('✅ 로컬 데이터 백업 완료');
        
        // 4. AWS RDS에 데이터 복원
        console.log('🔄 AWS RDS에 데이터 복원 중...');
        await restoreToAWS(awsConnection, backupData);
        console.log('✅ AWS RDS 데이터 복원 완료');
        
        // 5. 데이터 검증
        console.log('🔍 데이터 검증 중...');
        await validateMigration(localConnection, awsConnection);
        console.log('✅ 데이터 검증 완료');
        
        console.log('🎉 AWS 마이그레이션이 성공적으로 완료되었습니다!');
        
    } catch (error) {
        console.error('❌ 마이그레이션 중 오류 발생:', error);
        throw error;
    } finally {
        // 연결 종료
        if (localConnection) await localConnection.end();
        if (awsConnection) await awsConnection.end();
    }
}

async function backupLocalData(connection) {
    const tables = ['users', 'questions', 'answers', 'reports'];
    const backupData = {};
    
    for (const table of tables) {
        try {
            const [rows] = await connection.execute(`SELECT * FROM ${table}`);
            backupData[table] = rows;
            console.log(`  📋 ${table} 테이블: ${rows.length}개 레코드 백업`);
        } catch (error) {
            console.warn(`  ⚠️  ${table} 테이블 백업 실패:`, error.message);
        }
    }
    
    return backupData;
}

async function restoreToAWS(connection, backupData) {
    // 테이블 생성 (이미 존재하는 경우 무시)
    await createTables(connection);
    
    // 데이터 복원
    for (const [tableName, data] of Object.entries(backupData)) {
        if (data.length === 0) continue;
        
        try {
            // 기존 데이터 삭제 (선택사항)
            await connection.execute(`DELETE FROM ${tableName}`);
            
            // 데이터 삽입
            for (const record of data) {
                const columns = Object.keys(record).join(', ');
                const placeholders = Object.keys(record).map(() => '?').join(', ');
                const values = Object.values(record);
                
                const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
                await connection.execute(query, values);
            }
            
            console.log(`  ✅ ${tableName} 테이블: ${data.length}개 레코드 복원`);
        } catch (error) {
            console.error(`  ❌ ${tableName} 테이블 복원 실패:`, error.message);
        }
    }
}

async function createTables(connection) {
    const createTablesSQL = `
        -- Users 테이블
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            display_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            score INT DEFAULT 0,
            role ENUM('user', 'admin', 'super_admin') DEFAULT 'user',
            status ENUM('active', 'suspended') DEFAULT 'active',
            suspended_until TIMESTAMP NULL,
            suspension_reason TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            suspended_at TIMESTAMP NULL,
            level INT DEFAULT 1,
            experience INT DEFAULT 0,
            points INT DEFAULT 0,
            status_message TEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- Questions 테이블
        CREATE TABLE IF NOT EXISTS questions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            title VARCHAR(500) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- Answers 테이블
        CREATE TABLE IF NOT EXISTS answers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            question_id INT NOT NULL,
            user_id VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_question_id (question_id),
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- Reports 테이블
        CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reporter_id VARCHAR(255) NOT NULL,
            target_type ENUM('question', 'answer', 'user') NOT NULL,
            target_id INT NOT NULL,
            reason ENUM('spam', 'inappropriate', 'harassment', 'violence', 'copyright', 'other') NOT NULL,
            description TEXT,
            status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
            reviewed_by VARCHAR(255) NULL,
            reviewed_at TIMESTAMP NULL,
            admin_notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_reporter_id (reporter_id),
            INDEX idx_target (target_type, target_id),
            INDEX idx_status (status),
            INDEX idx_created_at (created_at DESC),
            UNIQUE KEY unique_user_report (reporter_id, target_type, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.execute(createTablesSQL);
    console.log('  ✅ AWS RDS 테이블 생성 완료');
}

async function validateMigration(localConnection, awsConnection) {
    const tables = ['users', 'questions', 'answers', 'reports'];
    
    for (const table of tables) {
        try {
            const [localCount] = await localConnection.execute(`SELECT COUNT(*) as count FROM ${table}`);
            const [awsCount] = await awsConnection.execute(`SELECT COUNT(*) as count FROM ${table}`);
            
            if (localCount[0].count === awsCount[0].count) {
                console.log(`  ✅ ${table}: ${localCount[0].count}개 레코드 검증 완료`);
            } else {
                console.warn(`  ⚠️  ${table}: 로컬 ${localCount[0].count}개, AWS ${awsCount[0].count}개 (불일치)`);
            }
        } catch (error) {
            console.warn(`  ⚠️  ${table} 검증 실패:`, error.message);
        }
    }
}

// 스크립트 실행
if (require.main === module) {
    migrateToAWS()
        .then(() => {
            console.log('🎯 마이그레이션 스크립트가 완료되었습니다.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 마이그레이션 실패:', error);
            process.exit(1);
        });
}

module.exports = { migrateToAWS };
