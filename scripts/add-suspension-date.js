#!/usr/bin/env node

/**
 * 정지 시작일 컬럼 추가 스크립트
 * Usage: node scripts/add-suspension-date.js
 */

require('dotenv').config();
const Database = require('../database/connection');

async function addSuspensionDate() {
    try {
        console.log('🔄 정지 시작일 컬럼 추가 중...');
        
        // suspended_at 컬럼 추가
        await Database.execute(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP NULL
        `);
        
        console.log('✅ suspended_at 컬럼 추가 완료');
        
        // 기존 정지된 사용자들의 suspended_at을 updated_at으로 설정
        await Database.execute(`
            UPDATE users 
            SET suspended_at = updated_at 
            WHERE status IN ('suspended', 'banned') AND suspended_at IS NULL
        `);
        
        console.log('✅ 기존 정지 사용자들의 정지 시작일 설정 완료');
        
        console.log('\n🎉 정지 시작일 기능 추가 완료!');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.error('🔍 오류 상세:', error);
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
addSuspensionDate();
