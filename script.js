// ==================== 설정 ====================
// 한국수출입은행 공식 환율 사용 - 정부 공인 데이터

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
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

// ==================== API 호출 - 한국수출입은행 ====================

async function fetchCurrentRates() {
  try {
    const response = await fetch('/.netlify/functions/exim-proxy?type=current');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.message || result.error);
    }

    if (result.rates) {
      exchangeRates = {
        KRW: 1,
        USD: result.rates.USD || 1440,
        JPY: result.rates.JPY || 9.74,
        EUR: result.rates.EUR || 1600,
        GBP: result.rates.GBP || 1850,
        CNY: result.rates.CNY || 200
      };

      console.log('✅ 한국수출입은행 현재 환율 로드 완료');
      console.log('출처: 한국수출입은행 (매일 11시 고시)');
      console.log('1 USD =', exchangeRates.USD.toFixed(2), 'KRW');

      return true;
    }

    throw new Error('환율 데이터 없음');

  } catch (error) {
    console.error('현재 환율 로드 실패:', error);
    exchangeRates = {
      KRW: 1,
      USD: 1440.41,
      JPY: 9.74,
      EUR: 1604.50,
      GBP: 1847.30,
      CNY: 200.45
    };
    console.warn('⚠️ 기본 환율 사용 중');
    return false;
  }
}

async function fetchHistoricalRate(currency, daysAgo) {
  try {
    const searchDate = getDateString(daysAgo);

    const response = await fetch(`/.netlify/functions/exim-proxy?type=historical&currency=${currency}&date=${searchDate}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      console.warn(`환율 조회 실패 (${currency}, ${daysAgo}일 전):`, result.message);
      return null;
    }

    if (result.rate) {
      console.log(`✅ ${currency} ${daysAgo}일 전: ${result.rate}`);
      return result.rate;
    }

    return null;
  } catch (error) {
    console.error(`환율 조회 실패 (${currency}, ${daysAgo}일 전):`, error);
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

    // KRW 포함 - 한국수출입은행 사용
    if (hasKRW()) {
      const targetCurrency = from === 'KRW' ? to : from;

      console.log(`한국수출입은행 ${targetCurrency} 과거 환율 조회...`);

      const [yesterdayRate, weekRate, monthRate, yearRate] = await Promise.all([
        fetchHistoricalRate(targetCurrency, 1),
        fetchHistoricalRate(targetCurrency, 7),
        fetchHistoricalRate(targetCurrency, 30),
        fetchHistoricalRate(targetCurrency, 365)
      ]);

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

        console.log('✅ 과거 환율 로드 완료');
        console.log('1일 전:', historicalRates.yesterday || '없음 (주말/공휴일)');
        console.log('7일 전:', historicalRates.week || '없음');
        console.log('30일 전:', historicalRates.month || '없음');
        console.log('365일 전:', historicalRates.year || '없음');
      } else {
        console.warn('⚠️ 과거 환율 데이터 없음 (주말/공휴일)');
        historicalRates.yesterday = 0;
        historicalRates.week = 0;
        historicalRates.month = 0;
        historicalRates.year = 0;
      }

      return;
    }

    // KRW 없음 - 현재 환율 유지
    historicalRates.yesterday = currentRate;
    historicalRates.week = currentRate;
    historicalRates.month = currentRate;
    historicalRates.year = currentRate;

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
    statusBar.textContent = '한국수출입은행 환율 정보를 불러오는 중...';

    await fetchCurrentRates();

    statusBar.textContent = '과거 환율 데이터를 불러오는 중...';
    await fetchHistoricalRates();

    statusBar.className = 'status-bar status-success';
    statusBar.textContent = '✓ 최신 환율 정보 업데이트 완료 (출처: 한국수출입은행)';

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

  // ✅ 항상 "1 USD = X KRW" 형식으로 표시
  let displayValue, displayFromCurr, displayToCurr;

  if (from === 'KRW') {
    // KRW → USD: 1 USD = X KRW
    displayValue = exchangeRates[to].toFixed(2);
    displayFromCurr = to;
    displayToCurr = from;
  } else if (to === 'KRW') {
    // USD → KRW: 1 USD = X KRW
    displayValue = exchangeRates[from].toFixed(2);
    displayFromCurr = from;
    displayToCurr = to;
  } else {
    // USD → EUR 등
    if (currentRate >= 1) {
      displayValue = currentRate.toFixed(4);
      displayFromCurr = from;
      displayToCurr = to;
    } else {
      displayValue = (1 / currentRate).toFixed(4);
      displayFromCurr = to;
      displayToCurr = from;
    }
  }

  rateValue.textContent = displayValue;
  rateToCurrency.textContent = displayFromCurr;
  rateFromCurrency.textContent = displayToCurr;

  const now = new Date();
  rateUpdate.textContent = `한국수출입은행 · ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} 확인`;

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
        <small>출처: 한국수출입은행 (매일 오전 11시 고시)</small>
        <br><br>
        과거 환율 데이터를 불러오는 중입니다...
        <br><small>※ 주말/공휴일은 데이터가 없을 수 있습니다</small>
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

  decision += `<br><br><small style="opacity: 0.8;">※ 출처: 한국수출입은행 (정부 공식 고시환율)</small>`;

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

// 1시간마다 자동 업데이트
setInterval(fetchExchangeRates, 3600000);
