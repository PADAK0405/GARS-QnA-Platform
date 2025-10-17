/**
 * 신고 테이블 추가 스크립트
 * 기존 데이터베이스에 reports 테이블을 추가합니다.
 */

const pool = require('../database/connection');

async function addReportsTable() {
    const connection = await pool.getConnection();
    
    try {
        console.log('신고 테이블을 생성하는 중...');
        
        // 신고 테이블 생성
        await connection.execute(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log('✅ 신고 테이블이 성공적으로 생성되었습니다.');
        
        // 테이블 구조 확인
        const [tables] = await connection.execute('SHOW TABLES LIKE "reports"');
        if (tables.length > 0) {
            console.log('📋 reports 테이블이 존재합니다.');
            
            // 컬럼 정보 확인
            const [columns] = await connection.execute('DESCRIBE reports');
            console.log('📊 테이블 구조:');
            columns.forEach(col => {
                console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL 허용)' : '(NOT NULL)'}`);
            });
        }
        
    } catch (error) {
        console.error('❌ 신고 테이블 생성 실패:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// 스크립트가 직접 실행된 경우
if (require.main === module) {
    addReportsTable()
        .then(() => {
            console.log('🎉 신고 테이블 생성 완료!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 스크립트 실행 실패:', error);
            process.exit(1);
        });
}

module.exports = { addReportsTable };
