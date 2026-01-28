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
        let { currency, startDate, endDate } = event.queryStringParameters;

        // ✅ 환경 변수에서만 가져오기
        const BOK_API_KEY = process.env.BOK_API_KEY;

        if (!BOK_API_KEY) {
            throw new Error('BOK_API_KEY 환경 변수가 설정되지 않았습니다');
        }

        // 🔧 한국은행 데이터는 2-3일 지연되므로, 최근 날짜는 조정
        const today = new Date();
        const endDateObj = new Date(
            endDate.substring(0, 4),
            parseInt(endDate.substring(4, 6)) - 1,
            endDate.substring(6, 8)
        );

        const daysDiff = Math.floor((today - endDateObj) / (1000 * 60 * 60 * 24));

        // 요청한 날짜가 3일 이내면 안전하게 5일 전으로 조정
        if (daysDiff < 5) {
            const safeDate = new Date(today);
            safeDate.setDate(safeDate.getDate() - 5);

            const originalStartObj = new Date(
                startDate.substring(0, 4),
                parseInt(startDate.substring(4, 6)) - 1,
                startDate.substring(6, 8)
            );

            // 원래 기간 유지하면서 날짜만 과거로 이동
            const rangeDays = Math.floor((endDateObj - originalStartObj) / (1000 * 60 * 60 * 24));
            const adjustedStart = new Date(safeDate);
            adjustedStart.setDate(adjustedStart.getDate() - rangeDays);

            endDate = safeDate.toISOString().split('T')[0].replace(/-/g, '');
            startDate = adjustedStart.toISOString().split('T')[0].replace(/-/g, '');

            console.log(`날짜 조정: ${startDate} ~ ${endDate} (데이터 지연 보정)`);
        }

        // 한국은행 API 호출
        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${BOK_API_KEY}/json/kr/1/100/036Y001/D/${startDate}/${endDate}/${currency}`;

        console.log('BOK API 호출 (키는 로그에 표시 안 됨)');

        const response = await axios.get(url);

        // 데이터 없음 처리
        if (response.data.RESULT && response.data.RESULT.CODE === 'INFO-200') {
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
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        console.error('BOK API 오류:', error.message);

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
