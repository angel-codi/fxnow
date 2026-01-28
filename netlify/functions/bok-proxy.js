// netlify/functions/bok-proxy.js
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
        const { currency, startDate, endDate } = event.queryStringParameters;

        // ✅ 환경 변수에서 API 키 가져오기
        const BOK_API_KEY = process.env.BOK_API_KEY;

        if (!BOK_API_KEY) {
            throw new Error('BOK_API_KEY 환경 변수가 설정되지 않았습니다');
        }

        // 🔧 한국은행 데이터는 실시간이 아니므로 넓은 범위로 요청
        // startDate를 30일 더 과거로, endDate는 그대로 사용
        const startDateObj = new Date(
            startDate.substring(0, 4),
            parseInt(startDate.substring(4, 6)) - 1,
            startDate.substring(6, 8)
        );
        startDateObj.setDate(startDateObj.getDate() - 30);  // 30일 더 과거

        const adjustedStartDate = startDateObj.toISOString().split('T')[0].replace(/-/g, '');

        // 한국은행 API 호출
        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${BOK_API_KEY}/json/kr/1/100/036Y001/D/${adjustedStartDate}/${endDate}/${currency}`;

        console.log(`BOK API 호출: ${currency}, ${adjustedStartDate} ~ ${endDate}`);

        const response = await axios.get(url, { timeout: 10000 });

        // 에러 응답 처리
        if (response.data.RESULT) {
            const resultCode = response.data.RESULT.CODE;
            if (resultCode === 'INFO-200') {
                // 데이터 없음
                console.warn('한국은행 데이터 없음:', response.data.RESULT.MESSAGE);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        error: 'NO_DATA',
                        message: '해당 기간의 데이터가 없습니다',
                        result: response.data
                    })
                };
            } else if (resultCode !== 'INFO-000') {
                // 기타 에러
                console.error('한국은행 API 에러:', response.data.RESULT);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        error: 'API_ERROR',
                        message: response.data.RESULT.MESSAGE,
                        code: resultCode
                    })
                };
            }
        }

        // 성공
        console.log(`✅ BOK API 성공: ${currency}, ${response.data.StatisticSearch?.row?.length || 0}개 데이터`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        console.error('BOK API 오류:', error.message);

        // 타임아웃 또는 네트워크 에러
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return {
                statusCode: 504,
                headers,
                body: JSON.stringify({
                    error: 'TIMEOUT',
                    message: '한국은행 API 응답 시간 초과'
                })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                details: '한국은행 API 호출에 실패했습니다'
            })
        };
    }
};
