#!/usr/bin/env node

/**
 * 관리자 권한 부여 스크립트
 * Usage: node scripts/make-admin.js <email> <role>
 * 
 * 역할 옵션:
 * - moderator: 모더레이터 (콘텐츠 숨기기/복원)
 * - admin: 관리자 (사용자 관리, 콘텐츠 관리)
 * - super_admin: 최고 관리자 (모든 권한)
 */

require('dotenv').config();
const Database = require('../database/queries');

async function makeAdmin(email, role) {
    if (!email || !role) {
        console.error('❌ 사용법: node scripts/make-admin.js <email> <role>');
        console.error('📋 역할 옵션: moderator, admin, super_admin');
        process.exit(1);
    }

    if (!['moderator', 'admin', 'super_admin'].includes(role)) {
        console.error('❌ 유효하지 않은 역할입니다.');
        console.error('📋 사용 가능한 역할: moderator, admin, super_admin');
        process.exit(1);
    }

    try {
        console.log(`🔍 사용자 찾는 중: ${email}`);
        
        // 사용자 찾기
        const [users] = await require('../database/connection').execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            console.error(`❌ 이메일 '${email}'에 해당하는 사용자를 찾을 수 없습니다.`);
            console.error('💡 사용자가 먼저 Google 로그인을 한 번 해야 데이터베이스에 등록됩니다.');
            process.exit(1);
        }

        const user = users[0];
        console.log(`✅ 사용자 찾음: ${user.display_name} (${user.email})`);
        console.log(`📊 현재 역할: ${user.role || 'user'}`);

        // 역할 업데이트
        await require('../database/connection').execute(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, user.id]
        );
        
        console.log(`🎉 성공! ${user.display_name}님이 ${getRoleText(role)}로 지정되었습니다.`);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

function getRoleText(role) {
    const roleMap = {
        'moderator': '모더레이터',
        'admin': '관리자',
        'super_admin': '최고 관리자'
    };
    return roleMap[role] || role;
}

// 스크립트 실행
const email = process.argv[2];
const role = process.argv[3];

makeAdmin(email, role);
