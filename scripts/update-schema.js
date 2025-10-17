/**
 * 데이터베이스 스키마 업데이트 스크립트
 * 사용자 테이블에 레벨 관련 컬럼을 추가합니다.
 */

const pool = require('../database/connection');

async function updateSchema() {
    console.log('🔄 데이터베이스 스키마를 업데이트합니다...');
    
    try {
        // 사용자 테이블에 레벨 관련 컬럼 추가
        const alterQueries = [
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT DEFAULT 1',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INT DEFAULT 0',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message VARCHAR(200) DEFAULT NULL',
            'ALTER TABLE users ADD INDEX IF NOT EXISTS idx_level (level DESC)',
            'ALTER TABLE users ADD INDEX IF NOT EXISTS idx_experience (experience DESC)'
        ];
        
        for (const query of alterQueries) {
            try {
                await pool.execute(query);
                console.log(`✅ 실행 완료: ${query}`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
                    console.log(`⚠️  이미 존재: ${query}`);
                } else {
                    throw error;
                }
            }
        }
        
        console.log('\n🎉 스키마 업데이트가 완료되었습니다!');
        
    } catch (error) {
        console.error('❌ 스키마 업데이트 실패:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
if (require.main === module) {
    updateSchema();
}

module.exports = updateSchema;
