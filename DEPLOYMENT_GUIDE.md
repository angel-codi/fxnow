# Netlify 배포 완전 가이드 - fxnow

## 🎯 목표
한국은행 Open API를 사용하여 정확한 KRW 과거 환율 데이터 제공

---

## 📁 필요한 파일 구조

```
fxnow/
├── netlify/
│   └── functions/
│       └── bok-proxy.js          # 한국은행 API 프록시
├── index.html                     # 기존 HTML
├── style.css                      # 기존 CSS
├── script.js                      # 수정된 JavaScript
├── netlify.toml                   # Netlify 설정
├── package.json                   # NPM 설정
└── README.md
```

---

## 🚀 배포 단계

### 1단계: 파일 준비

**1-1. 폴더 생성**
```bash
mkdir -p fxnow/netlify/functions
cd fxnow
```

**1-2. 파일 복사**
- `netlify/functions/bok-proxy.js` - 제공된 함수 파일
- `script.js` - 수정된 스크립트 (Netlify Functions 호출 버전)
- `netlify.toml` - 설정 파일
- `package.json` - NPM 설정
- `index.html`, `style.css` - 기존 파일

---

### 2단계: 한국은행 API 키 발급

**2-1. 회원가입**
1. https://ecos.bok.or.kr/ 접속
2. 우측 상단 "로그인" → "회원가입"
3. 정보 입력 후 가입

**2-2. API 키 발급**
1. 로그인 후 "인증키 신청/관리" 메뉴
2. "인증키 신청" 클릭
3. 용도 입력 (예: fxnow 환율 서비스)
4. 즉시 발급됨 (무료)
5. **키를 복사해두세요!**

---

### 3단계: GitHub 레포지토리 생성

**3-1. GitHub에서**
1. https://github.com 로그인
2. 우측 상단 "+" → "New repository"
3. Repository name: `fxnow`
4. Public 선택
5. "Create repository" 클릭

**3-2. 로컬에서 푸시**
```bash
# Git 초기화
git init

# .gitignore 생성
cat > .gitignore << EOF
node_modules/
.env
.netlify/
EOF

# 파일 추가
git add .
git commit -m "Initial commit"

# GitHub에 푸시
git branch -M main
git remote add origin https://github.com/[username]/fxnow.git
git push -u origin main
```

---

### 4단계: Netlify 배포

**4-1. Netlify 가입**
1. https://www.netlify.com/ 접속
2. "Sign up" → GitHub 계정으로 로그인

**4-2. 사이트 생성**
1. "Add new site" → "Import an existing project"
2. "Deploy with GitHub" 선택
3. `fxnow` 레포지토리 선택
4. Build settings:
   - Build command: (비워두기)
   - Publish directory: `.`
5. "Deploy site" 클릭

**4-3. 환경 변수 설정 (중요!)**
1. 배포된 사이트 대시보드 접속
2. "Site settings" → "Environment variables"
3. "Add a variable" 클릭
4. Key: `BOK_API_KEY`
5. Value: (발급받은 한국은행 API 키 입력)
6. "Save" 클릭

**4-4. 재배포**
1. "Deploys" 탭
2. "Trigger deploy" → "Deploy site"
3. 배포 완료 대기 (1-2분)

---

### 5단계: 테스트

**5-1. 사이트 접속**
```
https://[랜덤이름].netlify.app
```

**5-2. 기능 테스트**
1. KRW → USD 선택
2. 금액 입력 (예: 1,000,000)
3. F12 → Console 확인
4. "✅ 한국은행 과거 환율 로드 완료" 메시지 확인
5. 손익 계산 섹션이 표시되는지 확인

**5-3. 문제 발생 시**
- Console에서 에러 메시지 확인
- Network 탭에서 `/.netlify/functions/bok-proxy` 호출 확인
- Netlify 대시보드 → "Functions" 탭에서 로그 확인

---

## 🐛 트러블슈팅

### 문제 1: "BOK_API_KEY가 설정되지 않았습니다"

**원인:** 환경 변수 미설정

**해결:**
1. Netlify 대시보드 → Site settings → Environment variables
2. `BOK_API_KEY` 추가
3. 재배포

---

### 문제 2: Functions가 호출되지 않음

**원인:** netlify.toml 설정 오류

**해결:**
```toml
[build]
  functions = "netlify/functions"  # 경로 확인
```

---

### 문제 3: CORS 에러 여전히 발생

**원인:** Functions 내 헤더 설정 누락

**해결:**
`bok-proxy.js`에서 헤더 확인:
```javascript
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
```

---

### 문제 4: 과거 환율이 여전히 0으로 표시

**원인 1:** 한국은행 API 키 무효

**해결:**
- https://ecos.bok.or.kr/ 에서 키 재확인
- 새 키 발급 후 Netlify 환경 변수 업데이트

**원인 2:** 통화 코드 오류

**해결:**
`script.js`에서 통화 코드 확인:
```javascript
const bokCurrencyCode = {
    'USD': 'USD',
    'JPY': 'JPY(100)',  // JPY는 100엔 기준
    'EUR': 'EUR',
    'GBP': 'GBP',
    'CNY': 'CNY'
};
```

---

## 📊 성능 최적화

### Cold Start 최소화
```javascript
// bok-proxy.js에서
// 함수 외부에서 axios import (재사용)
const axios = require('axios');
```

### 캐싱 추가 (선택)
```javascript
// 1시간 캐싱
const headers = {
    ...headers,
    'Cache-Control': 'public, max-age=3600'
};
```

---

## 💰 비용

### Netlify 무료 플랜
- ✅ Functions: 125,000 요청/월
- ✅ 대역폭: 100GB/월
- ✅ 빌드 시간: 300분/월

**fxnow 예상 사용량:**
- 사용자당 요청: ~4회 (어제/7일/1달/1년)
- 31,250명까지 무료 사용 가능
- 실제로는 훨씬 여유로움 (캐싱 효과)

### 한국은행 API
- ✅ 완전 무료
- ⚠️ 일일 요청 제한: 10,000회

---

## 🎉 완료 확인

### 체크리스트
- [ ] Netlify 배포 완료
- [ ] 환경 변수 설정 완료
- [ ] 사이트 접속 가능
- [ ] KRW → USD 환전 테스트
- [ ] 과거 환율 데이터 로드 확인
- [ ] 손익 계산 정상 작동
- [ ] Console에 에러 없음

---

## 📈 다음 단계

### 단기
- [ ] 커스텀 도메인 연결 (선택)
- [ ] 성능 모니터링 설정
- [ ] 에러 추적 (Sentry 등)

### 중기
- [ ] 더 많은 통화 지원
- [ ] 사용자 알림 기능
- [ ] PWA 변환

---

## 🔗 유용한 링크

- [Netlify Functions 문서](https://docs.netlify.com/functions/overview/)
- [한국은행 API 문서](https://ecos.bok.or.kr/api/)
- [Netlify 커뮤니티](https://answers.netlify.com/)

---

## 📞 도움이 필요하면

1. Console 에러 메시지 복사
2. Netlify Functions 로그 확인
3. 이슈 제기 또는 질문

---

**축하합니다! 이제 fxnow가 정확한 KRW 과거 환율을 제공합니다! 🎉**
