/**
 * Google Gemini AI 헬퍼
 * 이미지 OCR 및 문제 풀이 기능
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAI {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️  GEMINI_API_KEY가 설정되지 않았습니다. AI 기능이 비활성화됩니다.');
            this.enabled = false;
            return;
        }
        
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        this.enabled = true;
    }

    /**
     * 입력 데이터를 안전하게 정제하는 함수
     */
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        
        // 프롬프트 인젝션 방지를 위한 위험 패턴 제거
        const dangerousPatterns = [
            /ignore\s+previous\s+instructions/gi,
            /forget\s+everything/gi,
            /new\s+instructions/gi,
            /system\s+prompt/gi,
            /act\s+as\s+if/gi,
            /pretend\s+to\s+be/gi,
            /you\s+are\s+now/gi,
            /from\s+now\s+on/gi,
            /override/gi,
            /jailbreak/gi,
            /roleplay/gi,
            /\[SYSTEM\]/gi,
            /\[INST\]/gi,
            /\[/g,
            /\]/g,
            /\{/g,
            /\}/g
        ];
        
        let sanitized = input;
        dangerousPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });
        
        // 길이 제한 (프롬프트 인젝션 방지)
        if (sanitized.length > 1000) {
            sanitized = sanitized.substring(0, 1000);
        }
        
        return sanitized.trim();
    }

    /**
     * 이미지에서 텍스트를 추출하고 질문에 답변
     */
    async analyzeQuestionWithImage(questionTitle, questionContent, imageUrl) {
        if (!this.enabled) {
            return null;
        }

        try {
            // 입력 데이터 정제
            const sanitizedTitle = this.sanitizeInput(questionTitle);
            const sanitizedContent = this.sanitizeInput(questionContent);
            
            // 이미지를 base64로 변환
            const imageData = await this.fetchImageAsBase64(imageUrl);
            
            // 안전한 프롬프트 템플릿 사용
            const prompt = `
당신은 학습 도우미입니다. 사용자의 질문과 첨부된 이미지를 분석하여 교육적인 답변을 제공해주세요.

질문 제목: ${sanitizedTitle}
질문 내용: ${sanitizedContent}

이미지에 문제나 텍스트가 있다면 OCR을 수행하여 내용을 파악하고, 질문에 대한 상세한 답변을 제공해주세요.
답변은 다음 형식으로 작성해주세요:

1. 이미지 내용 설명 (있다면)
2. 문제 분석
3. 해결 과정 또는 답변
4. 추가 설명 (필요시)

답변은 한국어로, 친근하고 이해하기 쉽게 작성해주세요.
교육적인 목적으로만 답변해주세요.
`;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: imageData.mimeType,
                        data: imageData.base64
                    }
                }
            ]);

            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini AI 오류:', error);
            return null;
        }
    }

    /**
     * 텍스트만 있는 질문에 답변
     */
    async analyzeTextQuestion(questionTitle, questionContent) {
        if (!this.enabled) {
            return null;
        }

        try {
            // 입력 데이터 정제
            const sanitizedTitle = this.sanitizeInput(questionTitle);
            const sanitizedContent = this.sanitizeInput(questionContent);
            
            // 안전한 프롬프트 템플릿 사용
            const prompt = `
당신은 학습 도우미입니다. 사용자의 질문에 교육적인 답변을 제공해주세요.

질문 제목: ${sanitizedTitle}
질문 내용: ${sanitizedContent}

질문을 분석하고 상세한 답변을 제공해주세요.
답변은 한국어로, 친근하고 이해하기 쉽게 작성해주세요.
교육적인 목적으로만 답변해주세요.
`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();
            
            // 응답 검증
            return this.validateAndSanitizeResponse(responseText);
        } catch (error) {
            console.error('Gemini AI 오류:', error);
            return null;
        }
    }

    /**
     * AI 응답을 검증하고 정제하는 함수
     */
    validateAndSanitizeResponse(response) {
        if (!response || typeof response !== 'string') {
            return '죄송합니다. 답변을 생성하는 중 오류가 발생했습니다.';
        }
        
        // 응답 길이 제한
        if (response.length > 5000) {
            response = response.substring(0, 5000) + '...';
        }
        
        // 위험한 내용 필터링
        const dangerousPatterns = [
            /system\s+prompt/gi,
            /api\s+key/gi,
            /password/gi,
            /secret/gi,
            /token/gi,
            /admin/gi,
            /root/gi,
            /sudo/gi,
            /rm\s+-rf/gi,
            /drop\s+table/gi,
            /delete\s+from/gi
        ];
        
        let sanitizedResponse = response;
        dangerousPatterns.forEach(pattern => {
            sanitizedResponse = sanitizedResponse.replace(pattern, '[필터링됨]');
        });
        
        return sanitizedResponse;
    }

    /**
     * URL을 안전하게 검증하는 함수 (SSRF 방지)
     */
    validateUrl(url) {
        try {
            const parsed = new URL(url);
            
            // 허용된 프로토콜만 허용
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }
            
            // 로컬호스트만 허용 (SSRF 방지)
            const allowedHosts = [
                'localhost',
                '127.0.0.1',
                '::1'
            ];
            
            if (!allowedHosts.includes(parsed.hostname)) {
                return false;
            }
            
            // 허용된 포트만 허용
            const allowedPorts = [
                '3000', // 애플리케이션 포트
                '80',   // HTTP
                '443'   // HTTPS
            ];
            
            if (parsed.port && !allowedPorts.includes(parsed.port)) {
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 이미지를 base64로 변환 (SSRF 방지 적용)
     */
    async fetchImageAsBase64(imageUrl) {
        const https = require('https');
        const http = require('http');
        const fs = require('fs');
        const path = require('path');

        return new Promise((resolve, reject) => {
            try {
                // 로컬 파일 경로인 경우 직접 읽기
                if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('./uploads/')) {
                    const filePath = path.join(process.cwd(), 'public', imageUrl.replace(/^\/+/, ''));
                    
                    // 경로 탐색 공격 방지
                    const resolvedPath = path.resolve(filePath);
                    const publicPath = path.resolve(path.join(process.cwd(), 'public'));
                    
                    if (!resolvedPath.startsWith(publicPath)) {
                        reject(new Error('잘못된 파일 경로입니다.'));
                        return;
                    }
                    
                    // 파일 존재 확인
                    if (!fs.existsSync(resolvedPath)) {
                        reject(new Error('파일을 찾을 수 없습니다.'));
                        return;
                    }
                    
                    // 파일 크기 제한 (10MB)
                    const stats = fs.statSync(resolvedPath);
                    if (stats.size > 10 * 1024 * 1024) {
                        reject(new Error('파일 크기가 너무 큽니다.'));
                        return;
                    }
                    
                    const buffer = fs.readFileSync(resolvedPath);
                    const base64 = buffer.toString('base64');
                    
                    // MIME 타입 추론
                    let mimeType = 'image/jpeg';
                    if (imageUrl.endsWith('.png')) mimeType = 'image/png';
                    else if (imageUrl.endsWith('.gif')) mimeType = 'image/gif';
                    else if (imageUrl.endsWith('.webp')) mimeType = 'image/webp';
                    
                    resolve({ base64, mimeType });
                    return;
                }
                
                // URL인 경우 안전성 검증
                let fullUrl = imageUrl;
                if (imageUrl.startsWith('/')) {
                    fullUrl = `http://localhost:${process.env.PORT || 3000}${imageUrl}`;
                }
                
                // URL 안전성 검증
                if (!this.validateUrl(fullUrl)) {
                    reject(new Error('허용되지 않는 URL입니다.'));
                    return;
                }
                
                const parsedUrl = new URL(fullUrl);
                const client = parsedUrl.protocol === 'https:' ? https : http;
                
                const request = client.get(fullUrl, {
                    timeout: 10000, // 10초 타임아웃
                    headers: {
                        'User-Agent': 'GARS-AI-Bot/1.0'
                    }
                }, (res) => {
                    // 응답 크기 제한 (10MB)
                    let contentLength = parseInt(res.headers['content-length'], 10);
                    if (contentLength && contentLength > 10 * 1024 * 1024) {
                        reject(new Error('파일 크기가 너무 큽니다.'));
                        return;
                    }
                    
                    // Content-Type 검증
                    const contentType = res.headers['content-type'];
                    if (contentType && !contentType.startsWith('image/')) {
                        reject(new Error('이미지 파일이 아닙니다.'));
                        return;
                    }
                    
                    const data = [];
                    let receivedLength = 0;
                    const maxLength = 10 * 1024 * 1024; // 10MB
                    
                    res.on('data', chunk => {
                        receivedLength += chunk.length;
                        if (receivedLength > maxLength) {
                            reject(new Error('파일 크기가 너무 큽니다.'));
                            return;
                        }
                        data.push(chunk);
                    });
                    
                    res.on('end', () => {
                        const buffer = Buffer.concat(data);
                        const base64 = buffer.toString('base64');
                        
                        // MIME 타입 추론
                        let mimeType = 'image/jpeg';
                        if (imageUrl.endsWith('.png')) mimeType = 'image/png';
                        else if (imageUrl.endsWith('.gif')) mimeType = 'image/gif';
                        else if (imageUrl.endsWith('.webp')) mimeType = 'image/webp';
                        
                        resolve({ base64, mimeType });
                    });
                });
                
                request.on('error', (error) => {
                    reject(new Error('이미지를 가져올 수 없습니다.'));
                });
                
                request.on('timeout', () => {
                    request.destroy();
                    reject(new Error('요청 시간이 초과되었습니다.'));
                });
                
            } catch (error) {
                reject(new Error('이미지 처리 중 오류가 발생했습니다.'));
            }
        });
    }
}

module.exports = new GeminiAI();

