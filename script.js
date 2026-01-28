// ==================== 설정 ====================

let exchangeRates = {};
let currentRate = 0;

let historicalRates = {
  yesterday: 0,
  week: 0,
  month: 0,
  year: 0
};

const currencySymbols = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
  EUR: '€',
  GBP: '£',
  CNY: '¥'
};

const bokCurrencyCode = {
  'USD': 'USD',
  'JPY': 'JPY(100)',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'CNY': 'CNY'
};

// ==================== DOM 요소 ====================

const fromCurrency = document.getElementById('fromCurrency');
const toCurrency = document.getElementById('toCurrency');
const fromAmount = document.getElementById('fromAmount');
const toAmount = document.getElementById('toAmount');
const fromSymbol = document.getElementById('fromSymbol');
const toSymbol = document.getElementById('toSymbol');
const statusBar = document.getElementById('statusBar');

const decisionCard = document.getElementById('decisionCard');
const decisionText = document.getElementById('decisionText');

const rateInfo = document.getElementById('rateInfo');
const rateValue = document.getElementById('rateValue');
const rateFromCurrency = document.getElementById('rateFromCurrency');
const rateToCurrency = document.getElementById('rateToCurrency');
const rateUpdate = document.getElementById('rateUpdate');

const profitLossSection = document.getElementById('profitLossSection');
const profitYesterday = document.getElementById('profitYesterday');
const profit7days = document.getElementById('profit7days');
const profit1month = document.getElementById('profit1month');

const analysisSection = document.getElementById('analysisSection');
const rate7days = document.getElementById('rate7days');
const rate1month = document.getElementById('rate1month');
const rate1year = document.getElementById('rate1year');
const summary7days = document.getElementById('summary7days');
const summary1month = document.getElementById('summary1month');
const summary1year = document.getElementById('summary1year');

// ==================== 유틸리티 함수 ====================

function isSameCurrency() {
  return fromCurrency.value === toCurrency.value;
}

function hasKRW() {
  return fromCurrency.value === 'KRW' || toCurrency.value === 'KRW';
}

function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function getBOKDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseNumber(str) {
  return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
}

function formatInput() {
  const amount = parseNumber(fromAmount.value);
  fromAmount.value = formatNumber(amount);
  convert();
  if (!isSameCurrency()) {
    updateProfitLoss();
    updateDecisionCard();
  }
}

function safePercentage(current, historical) {
  if (!historical || historical === 0 || !isFinite(historical)) {
    return 0;
  }
  const diff = ((current - historical) / historical * 100);
  return isFinite(diff) ? diff : 0;
}

function updateCurrencyOptions() {
  const allCurrencies = ['KRW', 'USD', 'JPY', 'EUR', 'GBP', 'CNY'];
  const fromValue = fromCurrency.value;
  const toValue = toCurrency.value;

  toCurrency.innerHTML = '';
  allCurrencies.forEach(currency => {
    if (currency !== fromValue) {
      const option = document.createElement('option');
      option.value = currency;
      option.textContent = currency;
      if (currency === toValue) {
        option.selected = true;
      }
      toCurrency.appendChild(option);
    }
  });

  if (fromValue === toValue) {
    toCurrency.value = allCurrencies.find(c => c !== fromValue);
  }
}

// ==================== API 호출 ====================

async function fetchCurrentRates() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const rates = data.rates;
    const usdToKrw = rates.KRW;

    exchangeRates = {
      KRW: 1,
      USD: usdToKrw,
      JPY: usdToKrw / rates.JPY,
      EUR: usdToKrw / rates.EUR,
      GBP: usdToKrw / rates.GBP,
      CNY: usdToKrw / rates.CNY
    };

    console.log('✅ 현재 환율 로드 완료');
    console.log('1 USD =', exchangeRates.USD.toFixed(2), 'KRW');

    return true;
  } catch (error) {
    console.error('현재 환율 로드 실패:', error);
    exchangeRates = {
      KRW: 1,
      USD: 1458.40,
      JPY: 9.74,
      EUR: 1604.50,
      GBP: 1847.30,
      CNY: 200.45
    };
    return false;
  }
}

// ✅ Netlify Functions를 통한 한국은행 API 호출
async function fetchBOKHistoricalRate(currency, daysAgo) {
  try {
    const currencyCode = bokCurrencyCode[currency];
    if (!currencyCode) return null;

    // 한국은행 데이터는 지연되므로 더 과거 날짜 사용
    const adjustedDaysAgo = daysAgo + 5;  // 5일 더 과거
    const endDate = getBOKDateString(adjustedDaysAgo);
    const startDate = getBOKDateString(adjustedDaysAgo + 10);

    // Netlify Function 엔드포인트 호출
    const functionUrl = `/.netlify/functions/bok-proxy?currency=${currencyCode}&startDate=${startDate}&endDate=${endDate}`;

    console.log(`한국은행 환율 조회: ${currency}, ${daysAgo}일 전 (조정: ${adjustedDaysAgo}일 전)`);

    const response = await fetch(functionUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 에러 응답 처리
    if (data.error) {
      console.warn(`한국은행 데이터 없음 (${currency}, ${daysAgo}일 전):`, data.message || data.error);
      return null;
    }

    if (data.StatisticSearch && data.StatisticSearch.row && data.StatisticSearch.row.length > 0) {
      const rows = data.StatisticSearch.row;
      // 가장 최근 데이터 사용
      const latestRow = rows[rows.length - 1];
      let rate = parseFloat(latestRow.DATA_VALUE);

      // JPY는 100엔 기준
      if (currency === 'JPY') {
        rate = rate / 100;
      }

      console.log(`✅ BOK 환율 (${currency}, ${daysAgo}일 전): ${rate}`);
      return rate;
    }

    console.warn(`한국은행 데이터 없음 (${currency}, ${daysAgo}일 전)`);
    return null;
  } catch (error) {
    console.error(`한국은행 환율 조회 실패 (${currency}):`, error);
    return null;
  }
}

async function fetchHistoricalRates() {
  try {
    const from = fromCurrency.value;
    const to = toCurrency.value;

    if (isSameCurrency()) {
      currentRate = 1;
      historicalRates.yesterday = 1;
      historicalRates.week = 1;
      historicalRates.month = 1;
      historicalRates.year = 1;
      return;
    } else {
      currentRate = exchangeRates[from] / exchangeRates[to];
    }

    console.log('현재 환율:', currentRate);

    // KRW 포함 - Netlify Functions 사용
    if (hasKRW()) {
      const targetCurrency = from === 'KRW' ? to : from;

      console.log(`Netlify Functions로 ${targetCurrency} 과거 환율 조회...`);

      const [yesterdayRate, weekRate, monthRate, yearRate] = await Promise.all([
        fetchBOKHistoricalRate(targetCurrency, 1),
        fetchBOKHistoricalRate(targetCurrency, 7),
        fetchBOKHistoricalRate(targetCurrency, 30),
        fetchBOKHistoricalRate(targetCurrency, 365)
      ]);

      // 한국은행 데이터가 하나라도 있으면 사용
      if (yesterdayRate || weekRate || monthRate || yearRate) {
        if (from === 'KRW') {
          historicalRates.yesterday = yesterdayRate ? (1 / yesterdayRate) : 0;
          historicalRates.week = weekRate ? (1 / weekRate) : 0;
          historicalRates.month = monthRate ? (1 / monthRate) : 0;
          historicalRates.year = yearRate ? (1 / yearRate) : 0;
        } else {
          historicalRates.yesterday = yesterdayRate || 0;
          historicalRates.week = weekRate || 0;
          historicalRates.month = monthRate || 0;
          historicalRates.year = yearRate || 0;
        }

        console.log('✅ 한국은행 과거 환율 로드 완료');
        console.log('어제:', historicalRates.yesterday || '없음');
        console.log('7일 전:', historicalRates.week || '없음');
        console.log('1달 전:', historicalRates.month || '없음');
        console.log('1년 전:', historicalRates.year || '없음');
      } else {
        console.warn('⚠️ 한국은행 데이터를 모두 가져올 수 없습니다');
        historicalRates.yesterday = 0;
        historicalRates.week = 0;
        historicalRates.month = 0;
        historicalRates.year = 0;
      }

      return;
    }

    // KRW 없음 - Frankfurter API
    const yesterday = getDateString(1);
    const week = getDateString(7);
    const month = getDateString(30);
    const year = getDateString(365);

    const [yesterdayData, weekData, monthData, yearData] = await Promise.all([
      fetch(`https://api.frankfurter.app/${yesterday}?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`https://api.frankfurter.app/${week}?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`https://api.frankfurter.app/${month}?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`https://api.frankfurter.app/${year}?from=${from}&to=${to}`).then(r => r.json())
    ]);

    historicalRates.yesterday = yesterdayData.rates?.[to] || currentRate;
    historicalRates.week = weekData.rates?.[to] || currentRate;
    historicalRates.month = monthData.rates?.[to] || currentRate;
    historicalRates.year = yearData.rates?.[to] || currentRate;

    console.log('✅ Frankfurter 과거 환율 로드 완료');

  } catch (error) {
    console.error('과거 환율 로드 실패:', error);
    historicalRates.yesterday = 0;
    historicalRates.week = 0;
    historicalRates.month = 0;
    historicalRates.year = 0;
  }
}

async function fetchExchangeRates() {
  try {
    statusBar.className = 'status-bar status-loading';
    statusBar.textContent = '환율 정보를 불러오는 중...';

    await fetchCurrentRates();

    statusBar.textContent = '과거 환율 데이터를 불러오는 중...';
    await fetchHistoricalRates();

    statusBar.className = 'status-bar status-success';
    statusBar.textContent = '✓ 최신 환율 정보 업데이트 완료';

    setTimeout(() => {
      statusBar.style.display = 'none';
    }, 3000);

    updateAll();
  } catch (error) {
    console.error('환율 가져오기 오류:', error);
    statusBar.className = 'status-bar status-error';
    statusBar.textContent = `⚠ 환율 정보를 불러올 수 없습니다`;

    updateAll();
  }
}

// ==================== UI 업데이트 ====================

function updateAll() {
  updateSymbols();
  updateCurrentRate();
  convert();

  if (isSameCurrency()) {
    profitLossSection.style.display = 'none';
    analysisSection.style.display = 'none';
    updateSameCurrencyCard();
  } else if (hasKRW() && historicalRates.month === 0) {
    profitLossSection.style.display = 'none';
    analysisSection.style.display = 'none';
    updateKRWLoadingCard();
  } else {
    updateProfitLoss();
    updateAnalysis();
    updateDecisionCard();
  }
}

function updateSymbols() {
  fromSymbol.textContent = currencySymbols[fromCurrency.value];
  toSymbol.textContent = currencySymbols[toCurrency.value];
}

function updateCurrentRate() {
  const from = fromCurrency.value;
  const to = toCurrency.value;

  if (Object.keys(exchangeRates).length === 0) return;

  if (isSameCurrency()) {
    currentRate = 1;
  } else {
    currentRate = exchangeRates[from] / exchangeRates[to];
  }

  let displayFrom, displayTo, displayRate;

  // ✅ 수정: 환율 표시 방향 올바르게
  if (currentRate >= 1) {
    // currentRate가 1 이상이면 그대로 표시
    // 예: 1 USD = 1440 KRW (currentRate = 1440)
    displayFrom = from;
    displayTo = to;
    displayRate = currentRate.toFixed(2);
  } else {
    // currentRate가 1 미만이면 역수로 표시
    // 예: 1 KRW = 0.0007 USD → 1 USD = 1440 KRW로 표시
    displayFrom = to;
    displayTo = from;
    displayRate = (1 / currentRate).toFixed(2);
  }

  // 최종 표시
  rateToCurrency.textContent = displayFrom;
  rateFromCurrency.textContent = displayTo;
  rateValue.textContent = displayRate;

  const now = new Date();
  rateUpdate.textContent = `실시간 · ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} 업데이트`;

  rateInfo.style.display = 'flex';
}

function convert() {
  const from = fromCurrency.value;
  const to = toCurrency.value;
  const amount = parseNumber(fromAmount.value);

  if (Object.keys(exchangeRates).length === 0) return;

  if (isSameCurrency()) {
    toAmount.value = formatNumber(amount.toFixed(2));
  } else {
    const inKRW = amount * exchangeRates[from];
    const result = inKRW / exchangeRates[to];
    toAmount.value = formatNumber(result.toFixed(2));
  }
}

function updateSameCurrencyCard() {
  const currency = fromCurrency.value;
  decisionCard.className = 'decision-card warning';
  decisionText.innerHTML = `동일한 통화(<span class="decision-highlight">${currency}</span>)입니다. 다른 통화를 선택해주세요.`;
  decisionCard.style.display = 'block';
}

function updateKRWLoadingCard() {
  decisionCard.className = 'decision-card';
  decisionText.innerHTML = `
        <span class="decision-highlight">현재 환율: 1 ${rateToCurrency.textContent} = ${rateValue.textContent} ${rateFromCurrency.textContent}</span>
        <br><br>
        과거 환율 데이터를 불러오는 중입니다...
    `;
  decisionCard.style.display = 'block';
}

function updateProfitLoss() {
  const amount = parseNumber(fromAmount.value);
  if (amount === 0 || isSameCurrency() || historicalRates.month === 0) {
    profitLossSection.style.display = 'none';
    return;
  }

  const from = fromCurrency.value;
  const to = toCurrency.value;

  const currentResult = (amount * exchangeRates[from]) / exchangeRates[to];

  const yesterdayRate = historicalRates.yesterday || currentRate;
  const yesterdayResult = (amount * exchangeRates[from]) / (exchangeRates[to] * (currentRate / yesterdayRate));
  const yesterdayDiff = currentResult - yesterdayResult;

  const weekRate = historicalRates.week || currentRate;
  const weekResult = (amount * exchangeRates[from]) / (exchangeRates[to] * (currentRate / weekRate));
  const weekDiff = currentResult - weekResult;

  const monthRate = historicalRates.month || currentRate;
  const monthResult = (amount * exchangeRates[from]) / (exchangeRates[to] * (currentRate / monthRate));
  const monthDiff = currentResult - monthResult;

  profitYesterday.innerHTML = formatProfitLoss(yesterdayDiff, to);
  profit7days.innerHTML = formatProfitLoss(weekDiff, to);
  profit1month.innerHTML = formatProfitLoss(monthDiff, to);

  profitLossSection.style.display = 'block';
}

function formatProfitLoss(diff, currency) {
  if (!isFinite(diff)) {
    return `<span class="neutral">계산 중...</span>`;
  }

  const symbol = currencySymbols[currency];
  const absDiff = Math.abs(diff);
  const formattedDiff = formatNumber(absDiff.toFixed(2));

  if (diff > 0.01) {
    return `<span class="profit">▲ ${formattedDiff} ${symbol} 더 받음</span>`;
  } else if (diff < -0.01) {
    return `<span class="loss">▼ ${formattedDiff} ${symbol} 덜 받음</span>`;
  } else {
    return `<span class="neutral">± 비슷함</span>`;
  }
}

function updateAnalysis() {
  if (isSameCurrency() || historicalRates.month === 0) {
    analysisSection.style.display = 'none';
    return;
  }

  const weekDiff = safePercentage(currentRate, historicalRates.week);
  rate7days.textContent = historicalRates.week > 1 ? historicalRates.week.toFixed(2) : historicalRates.week.toFixed(4);
  summary7days.innerHTML = `현재보다 <span class="analysis-diff ${weekDiff > 0 ? 'loss' : 'profit'}">${Math.abs(weekDiff).toFixed(2)}% ${weekDiff > 0 ? '저렴' : '비쌈'}</span>`;

  const monthDiff = safePercentage(currentRate, historicalRates.month);
  rate1month.textContent = historicalRates.month > 1 ? historicalRates.month.toFixed(2) : historicalRates.month.toFixed(4);
  summary1month.innerHTML = `현재보다 <span class="analysis-diff ${monthDiff > 0 ? 'loss' : 'profit'}">${Math.abs(monthDiff).toFixed(2)}% ${monthDiff > 0 ? '저렴' : '비쌈'}</span>`;

  const yearDiff = safePercentage(currentRate, historicalRates.year);
  rate1year.textContent = historicalRates.year > 1 ? historicalRates.year.toFixed(2) : historicalRates.year.toFixed(4);
  summary1year.innerHTML = `현재보다 <span class="analysis-diff ${yearDiff > 0 ? 'loss' : 'profit'}">${Math.abs(yearDiff).toFixed(2)}% ${yearDiff > 0 ? '저렴' : '비쌈'}</span>`;

  analysisSection.style.display = 'block';
}

function updateDecisionCard() {
  if (isSameCurrency()) {
    updateSameCurrencyCard();
    return;
  }

  if (historicalRates.month === 0) {
    updateKRWLoadingCard();
    return;
  }

  const weekDiff = safePercentage(currentRate, historicalRates.week);
  const monthDiff = safePercentage(currentRate, historicalRates.month);

  const from = fromCurrency.value;
  const to = toCurrency.value;

  let decision = '';

  decisionCard.className = 'decision-card';

  if (Math.abs(monthDiff) < 1) {
    decision = `지금은 <span class="decision-highlight">최근 1달 평균과 비슷</span>한 환율입니다. 적당한 타이밍이에요.`;
  } else if (monthDiff > 0) {
    if (from === 'KRW') {
      decision = `지금은 최근 1달 평균 대비 <span class="decision-highlight">'${to} 강세'로 유리(+${monthDiff.toFixed(1)}%)</span>합니다. 환전 추천!`;
    } else {
      decision = `지금은 최근 1달 평균 대비 <span class="decision-highlight">'${from} 약세'로 불리(+${monthDiff.toFixed(1)}%)</span>합니다. 여유 있다면 관망 추천.`;
    }
  } else {
    if (from === 'KRW') {
      decision = `지금은 최근 1달 평균 대비 <span class="decision-highlight">'${to} 약세'로 불리(${monthDiff.toFixed(1)}%)</span>합니다. 여유 있다면 관망 추천.`;
    } else {
      decision = `지금은 최근 1달 평균 대비 <span class="decision-highlight">'${from} 강세'로 유리(${monthDiff.toFixed(1)}%)</span>합니다. 환전 추천!`;
    }
  }

  if (Math.abs(weekDiff) > 2) {
    if (weekDiff > 0) {
      decision += `<br><br>단, 최근 7일간 +${weekDiff.toFixed(1)}% 상승 중이라 단기적으로는 조금 비싼 편입니다.`;
    } else {
      decision += `<br><br>최근 7일간 ${weekDiff.toFixed(1)}% 하락 중이라 단기적으로는 좋은 기회입니다.`;
    }
  }

  decisionText.innerHTML = decision;
  decisionCard.style.display = 'block';
}

// ==================== 이벤트 리스너 ====================

fromAmount.addEventListener('input', () => {
  convert();
  if (!isSameCurrency()) {
    updateProfitLoss();
    updateDecisionCard();
  }
});

fromAmount.addEventListener('blur', formatInput);

fromCurrency.addEventListener('change', async () => {
  fromAmount.value = '1';
  updateCurrencyOptions();
  await fetchHistoricalRates();
  updateAll();
});

toCurrency.addEventListener('change', async () => {
  fromAmount.value = '1';
  await fetchHistoricalRates();
  updateAll();
});

fromAmount.addEventListener('focus', function () {
  this.select();
});

// ==================== 초기화 ====================

updateCurrencyOptions();
updateSymbols();
fetchExchangeRates();

setInterval(fetchExchangeRates, 3600000);
