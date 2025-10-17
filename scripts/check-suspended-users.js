#!/usr/bin/env node

/**
 * 정지된 사용자 정보 확인 스크립트
 */

require('dotenv').config();
const Database = require('../database/connection');

async function checkSuspendedUsers() {
    try {
        console.log('🔍 정지된 사용자 정보 확인 중...');
        
        const [users] = await Database.execute(`
            SELECT 
                id, 
                display_name, 
                status, 
                suspended_until, 
                suspended_at, 
                suspension_reason,
                created_at,
                updated_at
            FROM users 
            WHERE status IN ('suspended', 'banned')
        `);
        
        if (users.length === 0) {
            console.log('정지된 사용자가 없습니다.');
            return;
        }
        
        console.log(`\n📊 정지된 사용자 ${users.length}명:`);
        console.log('='.repeat(80));
        
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.display_name} (${user.id})`);
            console.log(`   📧 상태: ${user.status}`);
            console.log(`   📅 정지 시작일: ${user.suspended_at || 'NULL'}`);
            console.log(`   ⏰ 정지 종료일: ${user.suspended_until || 'NULL'}`);
            console.log(`   📋 정지 사유: ${user.suspension_reason || 'NULL'}`);
            console.log(`   📅 가입일: ${user.created_at}`);
            console.log(`   📅 수정일: ${user.updated_at}`);
            console.log('-'.repeat(80));
        });
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
    } finally {
        process.exit(0);
    }
}

checkSuspendedUsers();
