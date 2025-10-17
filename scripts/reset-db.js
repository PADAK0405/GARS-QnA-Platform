/**
 * 데이터베이스 완전 초기화 스크립트
 * 모든 테이블을 DROP하고 다시 생성합니다
 * Usage: node scripts/reset-db.js
 */

require('dotenv').config();
const pool = require('../database/connection');
const fs = require('fs').promises;
const path = require('path');

async function resetDatabase() {
    console.log('  데이터베이스 완전 초기화 시작...\n');
    console.log('  모든 데이터가 삭제됩니다!\n');
    
    try {
        // 외래 키 체크 비활성화
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        
        console.log('🗑️  기존 테이블 삭제 중...');
        await pool.query('DROP TABLE IF EXISTS images');
        await pool.query('DROP TABLE IF EXISTS answers');
        await pool.query('DROP TABLE IF EXISTS questions');
        await pool.query('DROP TABLE IF EXISTS sessions');
        await pool.query('DROP TABLE IF EXISTS users');
        console.log(' 기존 테이블 삭제 완료\n');
        
        // 외래 키 체크 다시 활성화
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        
        // schema.sql 읽기 및 실행
        console.log(' 새 테이블 생성 중...');
        const schema = await fs.readFile(
            path.join(__dirname, '../database/schema.sql'),
            'utf8'
        );
        
        const queries = schema.split(';').filter(q => q.trim() && !q.trim().startsWith('--'));
        
        for (const query of queries) {
            if (query.trim()) {
                await pool.query(query);
            }
        }
        
        console.log(' 새 테이블 생성 완료\n');
        console.log(' 데이터베이스 완전 초기화 성공!\n');
        console.log(' 생성된 테이블:');
        console.log('  - users (사용자)');
        console.log('  - questions (질문)');
        console.log('  - answers (답변)');
        console.log('  - images (이미지)');
        console.log('  - sessions (세션)\n');
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n 데이터베이스 초기화 실패:', error.message);
        console.error('\n해결 방법:');
        console.error('  1. MySQL 서버가 실행 중인지 확인하세요');
        console.error('  2. .env 파일의 DB 설정을 확인하세요');
        console.error('  3. 데이터베이스 권한을 확인하세요\n');
        
        await pool.end();
        process.exit(1);
    }
}

resetDatabase();

