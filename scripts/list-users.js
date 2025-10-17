#!/usr/bin/env node

/**
 * 사용자 목록 조회 스크립트
 * Usage: node scripts/list-users.js
 */

require('dotenv').config();
const Database = require('../database/queries');

async function listUsers() {
    try {
        console.log('👥 사용자 목록 조회 중...\n');
        
        const users = await Database.getAllUsers(100, 0);
        
        if (users.length === 0) {
            console.log('📭 등록된 사용자가 없습니다.');
            return;
        }

        console.log('=' * 80);
        console.log('사용자 목록');
        console.log('=' * 80);
        
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.display_name}`);
            console.log(`   📧 이메일: ${user.email || 'N/A'}`);
            console.log(`   🏷️  역할: ${getRoleText(user.role)}`);
            console.log(`   📊 상태: ${getStatusText(user.status)}`);
            console.log(`   🎯 점수: ${user.score}`);
            console.log(`   📅 가입일: ${formatDate(user.created_at)}`);
            
            if (user.suspension_reason) {
                console.log(`   ⚠️  정지 사유: ${user.suspension_reason}`);
                if (user.suspended_until) {
                    console.log(`   📅 정지 기간: ${formatDate(user.suspended_until)}`);
                }
            }
            
            console.log('   ' + '-'.repeat(60));
        });
        
        console.log(`\n📊 총 ${users.length}명의 사용자가 등록되어 있습니다.`);
        
        // 역할별 통계
        const roleStats = users.reduce((stats, user) => {
            stats[user.role] = (stats[user.role] || 0) + 1;
            return stats;
        }, {});
        
        console.log('\n📈 역할별 통계:');
        Object.entries(roleStats).forEach(([role, count]) => {
            console.log(`   ${getRoleText(role)}: ${count}명`);
        });
        
    } catch (error) {
        console.error('❌ 사용자 목록 조회 실패:', error.message);
    } finally {
        process.exit(0);
    }
}

function getRoleText(role) {
    const roleMap = {
        'user': '일반 사용자',
        'moderator': '모더레이터',
        'admin': '관리자',
        'super_admin': '최고 관리자'
    };
    return roleMap[role] || role;
}

function getStatusText(status) {
    const statusMap = {
        'active': '활성',
        'suspended': '정지',
        'banned': '차단'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

listUsers();
