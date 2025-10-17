const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearAllData() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'qna_hub',
        charset: 'utf8mb4'
    });

    try {
        console.log('🗑️  데이터 삭제를 시작합니다...');
        
        // 1. 이미지 데이터 삭제
        console.log('📷 이미지 데이터 삭제 중...');
        await connection.execute('DELETE FROM images');
        console.log('✅ 이미지 데이터 삭제 완료');
        
        // 2. 답변 데이터 삭제
        console.log('💬 답변 데이터 삭제 중...');
        await connection.execute('DELETE FROM answers');
        console.log('✅ 답변 데이터 삭제 완료');
        
        // 3. 질문 데이터 삭제
        console.log('❓ 질문 데이터 삭제 중...');
        await connection.execute('DELETE FROM questions');
        console.log('✅ 질문 데이터 삭제 완료');
        
        // 4. AUTO_INCREMENT 초기화
        console.log('🔄 AUTO_INCREMENT 초기화 중...');
        await connection.execute('ALTER TABLE questions AUTO_INCREMENT = 1');
        await connection.execute('ALTER TABLE answers AUTO_INCREMENT = 1');
        await connection.execute('ALTER TABLE images AUTO_INCREMENT = 1');
        console.log('✅ AUTO_INCREMENT 초기화 완료');
        
        // 5. 사용자 점수와 EXP 초기화 (레벨은 1로 유지)
        console.log('👤 사용자 점수와 EXP 초기화 중...');
        await connection.execute('UPDATE users SET score = 0, experience = 0, level = 1');
        console.log('✅ 사용자 점수와 EXP 초기화 완료');
        
        console.log('🎉 모든 데이터 삭제가 완료되었습니다!');
        console.log('📊 사용자 정보는 그대로 유지되었습니다.');
        
    } catch (error) {
        console.error('❌ 데이터 삭제 중 오류 발생:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// 스크립트 실행
if (require.main === module) {
    clearAllData()
        .then(() => {
            console.log('✅ 스크립트 실행 완료');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 스크립트 실행 실패:', error);
            process.exit(1);
        });
}

module.exports = clearAllData;
