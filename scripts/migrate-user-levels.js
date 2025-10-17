/**
 * 사용자 레벨 시스템 마이그레이션 스크립트
 * 기존 사용자들에게 기본 레벨 정보를 추가합니다.
 */

const Database = require('../database/queries');

async function migrateUserLevels() {
    console.log('🔄 사용자 레벨 시스템 마이그레이션을 시작합니다...');
    
    try {
        const pool = require('../database/connection');
        
        // 기존 사용자들의 레벨과 EXP를 기본값으로 설정
        const [result] = await pool.execute(`
            UPDATE users 
            SET level = 1, experience = 0 
            WHERE level IS NULL OR experience IS NULL
        `);
        
        console.log(`✅ ${result.affectedRows}명의 사용자 레벨 정보가 업데이트되었습니다.`);
        
        // 모든 사용자의 레벨 정보 확인
        const [users] = await pool.execute(`
            SELECT id, display_name, level, experience 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        console.log('\n📊 현재 사용자 레벨 현황:');
        users.forEach(user => {
            console.log(`- ${user.display_name}: Level ${user.level}, EXP ${user.experience}`);
        });
        
        console.log('\n🎉 마이그레이션이 완료되었습니다!');
        
    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
if (require.main === module) {
    migrateUserLevels();
}

module.exports = migrateUserLevels;
