// netlify/functions/exim-proxy.js
// 한국수출입은행 공식 환율 API Proxy
const axios = require('axios');

exports.handler = async (event, context) => {
    // CORS 헤더
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // OPTIONS 요청 처리
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { type, currency, date } = event.queryStringParameters;
        
        // 환경 변수에서 API 키 가져오기
        const EXIM_API_KEY = process.env.EXIM_API_KEY;

        if (!EXIM_API_KEY) {
            throw new Error('EXIM_API_KEY 환경 변수가 설정되지 않았습니다');
        }

        let url;
        
        if (type === 'current') {
            // 최신 환율 조회
            url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${EXIM_API_KEY}&data=AP01`;
            console.log('한국수출입은행 최신 환율 조회');
        } else if (type === 'historical' && date) {
            // 특정 날짜 환율 조회
            url = `https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${EXIM_API_KEY}&searchdate=${date}&data=AP01`;
            console.log(`한국수출입은행 과거 환율 조회: ${date}`);
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'INVALID_PARAMS',
                    message: 'type과 date 파라미터가 필요합니다'
                })
            };
        }

        // API 호출
        const response = await axios.get(url, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'fxnow/1.0'
            }
        });

        const data = response.data;

        // 에러 응답 처리
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('한국수출입은행 데이터 없음');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    error: 'NO_DATA',
                    message: '환율 데이터가 없습니다. 주말/공휴일일 수 있습니다.'
                })
            };
        }

        // result 필드가 1이 아니면 에러
        if (data[0].result !== 1) {
            console.error('한국수출입은행 API 에러:', data[0]);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    error: 'API_ERROR',
                    message: '환율 조회 실패'
                })
            };
        }

        // 데이터 파싱
        const rates = {};
        data.forEach(item => {
            const curUnit = item.cur_unit;
            const rate = parseFloat(item.deal_bas_r.replace(/,/g, ''));
            
            if (curUnit === 'USD') {
                rates.USD = rate;
            } else if (curUnit === 'JPY(100)') {
                rates.JPY = rate / 100;  // 100엔당 -> 1엔당
            } else if (curUnit === 'EUR') {
                rates.EUR = rate;
            } else if (curUnit === 'GBP') {
                rates.GBP = rate;
            } else if (curUnit === 'CNH') {  // 중국 위안 (해외)
                rates.CNY = rate;
            } else if (curUnit === 'CNY') {  // 중국 위안
                rates.CNY = rate;
            }
        });

        // currency 필터링
        if (currency && type === 'historical') {
            const targetRate = rates[currency] || rates[currency.replace('(100)', '')] || null;
            
            if (targetRate === null) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        error: 'NO_DATA',
                        message: `${currency} 환율 데이터가 없습니다.`
                    })
                };
            }
            
            console.log(`✅ 한국수출입은행 ${currency} 환율: ${targetRate}`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    currency: currency,
                    rate: targetRate,
                    date: date,
                    source: '한국수출입은행'
                })
            };
        }

        // 전체 환율 반환
        console.log(`✅ 한국수출입은행 API 성공: ${Object.keys(rates).length}개 통화`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                rates: rates,
                source: '한국수출입은행',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('한국수출입은행 API 오류:', error.message);
        
        // 타임아웃
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return {
                statusCode: 504,
                headers,
                body: JSON.stringify({ 
                    error: 'TIMEOUT',
                    message: '한국수출입은행 API 응답 시간 초과'
                })
            };
        }

        // 네트워크 에러
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({ 
                    error: 'NETWORK_ERROR',
                    message: '한국수출입은행 API 연결 실패'
                })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: '한국수출입은행 API 호출 실패'
            })
        };
    }
};
