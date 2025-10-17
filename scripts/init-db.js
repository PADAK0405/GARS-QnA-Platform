/**
 * 데이터베이스 초기화 스크립트
 * Usage: node scripts/init-db.js
 */

require('dotenv').config();
const Database = require('../database/queries');

async function initDatabase() {
    console.log('데이터베이스 초기화 시작...\n');
    
    try {
        await Database.initializeDatabase();
        console.log('\n 데이터베이스가 성공적으로 초기화되었습니다!');
        console.log('\n 생성된 테이블:');
        console.log('  - users (사용자)');
        console.log('  - questions (질문)');
        console.log('  - answers (답변)');
        console.log('  - images (이미지)');
        console.log('  - sessions (세션)\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n 데이터베이스 초기화 실패:', error.message);
        console.error('\n 해결 방법:');
        console.error('  1. MySQL 서버가 실행 중인지 확인하세요');
        console.error('  2. .env 파일의 DB 설정을 확인하세요');
        console.error('  3. 데이터베이스 권한을 확인하세요\n');
        
        process.exit(1);
    }
}

initDatabase();

