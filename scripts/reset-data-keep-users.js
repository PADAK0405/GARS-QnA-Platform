#!/usr/bin/env node

require('dotenv').config();
const pool = require('../database/connection');

async function resetDataKeepUsers() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('🔄 데이터 초기화 중... (사용자 정보 유지)');

        // 1. 관리자 로그 삭제
        await connection.execute('DELETE FROM admin_logs');
        console.log('✅ 관리자 로그 삭제 완료');

        // 2. 답변 삭제
        await connection.execute('DELETE FROM answers');
        console.log('✅ 답변 삭제 완료');

        // 3. 질문 삭제
        await connection.execute('DELETE FROM questions');
        console.log('✅ 질문 삭제 완료');

        // 4. 사용자 점수 초기화 (선택사항)
        await connection.execute('UPDATE users SET score = 0');
        console.log('✅ 사용자 점수 초기화 완료');

        // 5. 사용자 상태를 active로 초기화 (선택사항)
        await connection.execute(`
            UPDATE users 
            SET status = 'active', 
                suspended_until = NULL, 
                suspension_reason = NULL, 
                suspended_at = NULL 
            WHERE status IN ('suspended', 'banned')
        `);
        console.log('✅ 사용자 상태 초기화 완료 (정지 해제)');

        console.log('\n🎉 데이터 초기화 완료!');
        console.log('📊 유지된 데이터:');
        console.log('   - 사용자 계정 정보');
        console.log('   - 사용자 역할 (admin, user 등)');
        console.log('   - 사용자 프로필 정보');
        console.log('\n🗑️  삭제된 데이터:');
        console.log('   - 모든 질문');
        console.log('   - 모든 답변');
        console.log('   - 관리자 로그');
        console.log('   - 사용자 점수 (0으로 초기화)');
        console.log('   - 정지 상태 (해제됨)');

    } catch (error) {
        console.error('❌ 데이터 초기화 실패:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
        pool.end();
    }
}

resetDataKeepUsers();
