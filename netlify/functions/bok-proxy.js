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
        const BOK_API_KEY = process.env.BOK_API_KEY;

        if (!BOK_API_KEY) {
            throw new Error('BOK_API_KEY가 설정되지 않았습니다');
        }

        // 한국은행 API 호출
        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${BOK_API_KEY}/json/kr/1/100/036Y001/D/${startDate}/${endDate}/${currency}`;
        
        console.log('BOK API 호출:', url);
        
        const response = await axios.get(url);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        console.error('BOK API 오류:', error);
        
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
