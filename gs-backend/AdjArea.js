// [2026.10.19 5번 — ai-lead2 시제품, 상수 자료] 조정대상지역 지정·해제 이력표(「주택법」 제63조의2)
//  ※ 세무사님 확인 전에는 운영 판정에 쓰지 않는다. 지금은 재현기 재기(CASEPROC_AI_ADJ_TRIAL_ = true)에서만 읽는다.
//  출처: 국토교통부 행정규칙(훈령·예규·고시) 게시판 공고 원문(molit.go.kr …/m_45/dtl.jsp?idx=번호),
//        2025·2026 공고는 국가법령정보센터 행정규칙 「조정대상지역 지정」 연혁(law.go.kr admRulSeq=번호). 기사·블로그는 쓰지 않았다.
//  모든 공고는 "공고한 날부터 효력"(본문 4.). 예외 — 2017-1305호는 예정지 공고(법률 제14866호 「주택법」 부칙 §2)라 효력일 '확인 필요'.
//  지역 적는 법: 시도 + (시·군) + (구). ex = 빼는 읍·면·동·리, only = 그 읍·면·동만, zone = 택지개발지구·예정지역처럼 동 이름으로 못 가르는 범위(→ '확인 필요').
//  exRi = 그 면 안에서 빼는 리(면 전체가 아니라 리 몇 개만 뺀 경우).
var CASEPROC_ADJ_MOLIT_ = 'https://www.molit.go.kr/USR/I0204/m_45/dtl.jsp?idx=';
var CASEPROC_ADJ_LAW_ = 'https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=';
var CASEPROC_ADJ_SEOUL25_ = ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'];
var CASEPROC_ADJ_SEOUL21_ = CASEPROC_ADJ_SEOUL25_.filter(function (g) { return ['서초구', '강남구', '송파구', '용산구'].indexOf(g) === -1; });
function caseProcAdjL_(sd, list) { return list.map(function (g) { return { sd: sd, gu: g }; }); }
var CASEPROC_ADJ_EVENTS_ = [
  { no: '2017-1305', date: '2017-09-06', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '15151', dateNote: '예정지 공고 — 법률 제14866호 「주택법」(2017.8.9., 시행 2017.11.10.) 부칙 §2. 거주요건은 소득세법 시행령 §154②로 2017-08-03부터 조정(해설서 479쪽 "2017.8.3.에 최초 지정 의제"), 중과·장기보유특별공제의 2017-08-03~11-09는 그 조문 확인 필요',
    areas: caseProcAdjL_('서울', CASEPROC_ADJ_SEOUL25_).concat([
      { sd: '경기', si: '과천시' }, { sd: '경기', si: '광명시' }, { sd: '경기', si: '성남시' }, { sd: '경기', si: '고양시' }, { sd: '경기', si: '남양주시' }, { sd: '경기', si: '하남시' },
      // [해설서 483쪽 주1·공고 대조] 목록 동·리 밖 주소는 아님, 안이면 지구 경계 확인 필요. 동탄면 리는 뒤에 법정동(○○동)으로 바뀐 곳이 있어 동 이름도 함께
      { sd: '경기', si: '화성시', only: ['반송동', '석우동', '금곡리', '목리', '방교리', '산척리', '송리', '신리', '영천리', '오산리', '장지리', '중리', '청계리', '금곡동', '목동', '방교동', '산척동', '송동', '신동', '영천동', '오산동', '장지동', '중동', '청계동'], zone: '동탄2택지개발지구(반송동·석우동, 동탄면 금곡리·목리·방교리·산척리·송리·신리·영천리·오산리·장지리·중리·청계리 일원)에 한함' },
      { sd: '세종', si: '세종특별자치시', zone: '행정중심복합도시 건설 예정지역(건설교통부고시 제2006-418호)에 한함' }
    ]).concat(caseProcAdjL_('부산', ['해운대구', '연제구', '동래구', '남구', '부산진구', '수영구'])).concat([{ sd: '부산', si: '기장군' }]) },
  { no: '2018-1088', date: '2018-08-28', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '15659', areas: [
    { sd: '경기', si: '구리시' }, { sd: '경기', si: '안양시', gu: '동안구' },
    { sd: '경기', si: '수원시', gu: '영통구', only: ['이의동', '원천동', '하동', '매탄동'], zone: '광교택지개발지구에 한함' },
    { sd: '경기', si: '수원시', gu: '팔달구', only: ['우만동'], zone: '광교택지개발지구에 한함' }, { sd: '경기', si: '수원시', gu: '장안구', only: ['연무동'], zone: '광교택지개발지구에 한함' },
    { sd: '경기', si: '용인시', gu: '수지구', only: ['상현동'], zone: '광교택지개발지구에 한함' }, { sd: '경기', si: '용인시', gu: '기흥구', only: ['영덕동'], zone: '광교택지개발지구에 한함' }] },
  { no: '2018-1089', date: '2018-08-28', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '15660', areas: [{ sd: '부산', si: '기장군', ex: ['일광면'] }] },
  { no: '2018-1766', date: '2018-12-31', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '15909', areas: [{ sd: '경기', si: '수원시', gu: '팔달구' }, { sd: '경기', si: '용인시', gu: '수지구' }, { sd: '경기', si: '용인시', gu: '기흥구' }] },
  { no: '2018-1767', date: '2018-12-31', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '15910', areas: caseProcAdjL_('부산', ['부산진구', '남구', '연제구']).concat([{ sd: '부산', si: '기장군', only: ['일광면'] }]) },
  { no: '2019-1540', date: '2019-11-08', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '16220', areas: [
    { sd: '경기', si: '고양시', zone: '삼송·원흥·지축·향동·덕은·킨텍스1단계·고양관광문화단지(한류월드) 택지지구는 해제에서 제외' },
    { sd: '경기', si: '남양주시', ex: ['다산동', '별내동'], note: '공고 원문 "남양주시(다산동·별내동 제외)" — 해설서 주7과 같음(예전 표는 지구로 잘못 적었음)' }].concat(caseProcAdjL_('부산', ['해운대구', '수영구', '동래구'])) },
  { no: '2020-197', date: '2020-02-21', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '17015', areas: [
    { sd: '경기', si: '수원시', gu: '영통구' }, { sd: '경기', si: '수원시', gu: '권선구' }, { sd: '경기', si: '수원시', gu: '장안구' }, { sd: '경기', si: '안양시', gu: '만안구' }, { sd: '경기', si: '의왕시' }] },
  { no: '2020-828', date: '2020-06-19', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '17018', areas: [
    { sd: '경기', si: '고양시' }, { sd: '경기', si: '남양주시', ex: ['화도읍', '수동면', '조안면'] }, { sd: '경기', si: '군포시' },
    { sd: '경기', si: '안성시', ex: ['일죽면'], exRi: { 죽산면: ['죽산리', '용설리', '장계리', '매산리', '장릉리', '장원리', '두현리'], 삼죽면: ['용월리', '덕산리', '율곡리', '내장리', '배태리'] } },
    { sd: '경기', si: '부천시' }, { sd: '경기', si: '안산시' }, { sd: '경기', si: '시흥시' },
    { sd: '경기', si: '용인시', gu: '처인구', ex: ['포곡읍', '모현면', '모현읍', '백암면', '양지면'], exRi: { 원삼면: ['가재월리', '사암리', '미평리', '좌항리', '맹리', '두창리'] } },
    { sd: '경기', si: '오산시' }, { sd: '경기', si: '평택시' }, { sd: '경기', si: '광주시', ex: ['초월읍', '곤지암읍', '도척면', '퇴촌면', '남종면', '남한산성면'] },
    { sd: '경기', si: '양주시' }, { sd: '경기', si: '의정부시' }]
    .concat(caseProcAdjL_('인천', ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구'])).concat(caseProcAdjL_('대전', ['동구', '중구', '서구', '유성구', '대덕구']))
    .concat([{ sd: '충북', si: '청주시', ex: ['낭성면', '미원면', '가덕면', '남일면', '문의면', '남이면', '현도면', '강내면', '옥산면', '내수읍', '북이면'] }]) },
  { no: '2020-877', date: '2020-06-19', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '17020', dateNote: '정정공고(2020-06-29) — 2020-828호 대상지역에 화성시 추가. 2020-06-19~06-28 사이 날짜는 확인 필요', areas: [{ sd: '경기', si: '화성시' }] },
  { no: '2020-1521', date: '2020-11-20', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '17021', areas: [{ sd: '경기', si: '김포시', ex: ['통진읍', '대곶면', '월곶면', '하성면'] }]
    .concat(caseProcAdjL_('부산', ['해운대구', '동래구', '수영구', '연제구', '남구'])).concat([{ sd: '대구', gu: '수성구' }]) },
  { no: '2020-1650', date: '2020-12-18', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '17024', areas: caseProcAdjL_('부산', ['서구', '동구', '영도구', '부산진구', '금정구', '북구', '강서구', '사상구', '사하구'])
    .concat(caseProcAdjL_('대구', ['중구', '동구', '서구', '남구', '북구', '달서구'])).concat([{ sd: '대구', si: '달성군', ex: ['가창면', '구지면', '하빈면', '논공읍', '옥포읍', '유가읍', '현풍읍'] }])
    .concat(caseProcAdjL_('광주', ['동구', '서구', '남구', '북구', '광산구'])).concat(caseProcAdjL_('울산', ['중구', '남구'])).concat([
      { sd: '경기', si: '파주시', ex: ['문산읍', '파주읍', '법원읍', '조리읍', '월롱면', '탄현면', '광탄면', '파평면', '적성면', '군내면', '장단면', '진동면', '진서면'] },
      { sd: '충남', si: '천안시', gu: '동남구', ex: ['목천읍', '풍세면', '광덕면', '북면', '성남면', '수신면', '병천면', '동면'] },
      { sd: '충남', si: '천안시', gu: '서북구', ex: ['성환읍', '성거읍', '직산읍', '입장면'] },
      { sd: '충남', si: '논산시', ex: ['강경읍', '연무읍', '성동면', '광석면', '노성면', '상월면', '부적면', '연산면', '벌곡면', '양촌면', '가야곡면', '은진면', '채운면'] },
      { sd: '충남', si: '공주시', ex: ['유구읍', '이인면', '탄천면', '계룡면', '반포면', '의당면', '정안면', '우성면', '사곡면', '신풍면'] },
      { sd: '전북', si: '전주시', gu: '완산구' }, { sd: '전북', si: '전주시', gu: '덕진구' },
      { sd: '전남', si: '여수시', ex: ['돌산읍', '율촌면', '화양면', '남면', '화정면', '삼산면'] },
      { sd: '전남', si: '순천시', ex: ['승주읍', '황전면', '월등면', '주암면', '송광면', '외서면', '낙안면', '별량면', '상사면'] },
      { sd: '전남', si: '광양시', ex: ['봉강면', '옥룡면', '옥곡면', '진상면', '진월면', '다압면'] },
      { sd: '경북', si: '포항시', gu: '남구', ex: ['구룡포읍', '연일읍', '오천읍', '대송면', '동해면', '장기면', '호미곶면'] },
      { sd: '경북', si: '경산시', ex: ['하양읍', '진량읍', '압량읍', '와촌면', '자인면', '용성면', '남산면', '남천면'] },
      { sd: '경남', si: '창원시', gu: '성산구' }]) },
  { no: '2020-1650', date: '2020-12-18', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '17024', areas: [
    { sd: '인천', gu: '중구', only: ['을왕동', '남북동', '덕교동', '무의동'] }, { sd: '경기', si: '양주시', only: ['백석읍', '남면', '광적면', '은현면'] },
    { sd: '경기', si: '안성시', only: ['미양면', '대덕면', '양성면', '고삼면', '보개면', '서운면', '금광면', '죽산면', '삼죽면'] }] },
  { no: '2021-1309', date: '2021-08-30', kind: '지정', src: CASEPROC_ADJ_MOLIT_ + '17012', areas: [{ sd: '경기', si: '동두천시', ex: ['광암동', '걸산동', '안흥동', '상봉암동', '하봉암동', '탑동동'] }] },
  { no: '2022-883', date: '2022-07-05', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '17524', areas: [
    { sd: '경기', si: '안산시', gu: '단원구', only: ['대부동동', '대부남동', '대부북동', '선감동', '풍도동'] }, { sd: '경기', si: '화성시', only: ['서신면'] }]
    .concat(caseProcAdjL_('대구', ['동구', '서구', '남구', '북구', '중구', '달서구'])).concat([{ sd: '대구', si: '달성군' }, { sd: '경북', si: '경산시' }, { sd: '전남', si: '여수시' }, { sd: '전남', si: '순천시' }, { sd: '전남', si: '광양시' }]) },
  { no: '2022-1207', date: '2022-09-26', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '17594', areas: [
    { sd: '경기', si: '동두천시' }, { sd: '경기', si: '양주시' }, { sd: '경기', si: '파주시' }, { sd: '경기', si: '평택시' }, { sd: '경기', si: '안성시' }]
    .concat(caseProcAdjL_('부산', ['해운대구', '수영구', '동래구', '남구', '연제구', '서구', '동구', '영도구', '부산진구', '금정구', '북구', '강서구', '사상구', '사하구']))
    .concat([{ sd: '대구', gu: '수성구' }]).concat(caseProcAdjL_('광주', ['동구', '서구', '남구', '북구', '광산구'])).concat(caseProcAdjL_('대전', ['동구', '중구', '서구', '유성구', '대덕구']))
    .concat(caseProcAdjL_('울산', ['중구', '남구'])).concat([{ sd: '충북', si: '청주시' }, { sd: '충남', si: '천안시' }, { sd: '충남', si: '논산시' }, { sd: '충남', si: '공주시' },
      { sd: '전북', si: '전주시' }, { sd: '경북', si: '포항시', gu: '남구' }, { sd: '경남', si: '창원시', gu: '성산구' }]) },
  { no: '2022-1408', date: '2022-11-14', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '17626', areas: [
    { sd: '경기', si: '성남시', gu: '중원구' }, { sd: '경기', si: '구리시' }, { sd: '경기', si: '안양시' }, { sd: '경기', si: '수원시' }, { sd: '경기', si: '의왕시' }, { sd: '경기', si: '고양시' },
    { sd: '경기', si: '남양주시' }, { sd: '경기', si: '화성시' }, { sd: '경기', si: '군포시' }, { sd: '경기', si: '부천시' }, { sd: '경기', si: '안산시' }, { sd: '경기', si: '시흥시' },
    { sd: '경기', si: '용인시' }, { sd: '경기', si: '오산시' }, { sd: '경기', si: '광주시' }, { sd: '경기', si: '의정부시' }, { sd: '경기', si: '김포시' },
    { sd: '세종', si: '세종특별자치시' }].concat(caseProcAdjL_('인천', ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구'])) },
  { no: '2023-2', date: '2023-01-05', kind: '해제', src: CASEPROC_ADJ_MOLIT_ + '17701', areas: caseProcAdjL_('서울', CASEPROC_ADJ_SEOUL21_).concat([
    { sd: '경기', si: '과천시' }, { sd: '경기', si: '성남시', gu: '수정구' }, { sd: '경기', si: '성남시', gu: '분당구' }, { sd: '경기', si: '하남시' }, { sd: '경기', si: '광명시' }]) },
  { no: '2025-1223', date: '2025-10-16', kind: '지정', src: CASEPROC_ADJ_LAW_ + '2100000265026', areas: caseProcAdjL_('서울', CASEPROC_ADJ_SEOUL21_).concat([
    { sd: '경기', si: '수원시', gu: '장안구' }, { sd: '경기', si: '수원시', gu: '팔달구' }, { sd: '경기', si: '수원시', gu: '영통구' },
    { sd: '경기', si: '성남시', gu: '수정구' }, { sd: '경기', si: '성남시', gu: '중원구' }, { sd: '경기', si: '성남시', gu: '분당구' },
    { sd: '경기', si: '안양시', gu: '동안구' }, { sd: '경기', si: '과천시' }, { sd: '경기', si: '용인시', gu: '수지구' }, { sd: '경기', si: '광명시' }, { sd: '경기', si: '하남시' }, { sd: '경기', si: '의왕시' }]) },
  { no: '2026-882', date: '2026-07-01', kind: '지정', src: CASEPROC_ADJ_LAW_ + '2100000281588', areas: [{ sd: '경기', si: '화성시', gu: '동탄구' }, { sd: '경기', si: '용인시', gu: '기흥구' }, { sd: '경기', si: '구리시' }] }
];
// 공식 출처로 아직 못 찾은 것(표에 넣지 않음 — '확인 필요')
var CASEPROC_ADJ_UNVERIFIED_ = [
  // [풀림 2026.10.19 세무사님·조정 세션] 2016~2017 청약조정대상지역은 세법상 조정대상지역이 아님(쓰지 않음). 2017-08-03~11-09는 거주요건에 한해 소령 §154② 표 지역 = 조정
  '2017-08-03~11-09 기간을 중과(§167의3 등)·장기보유특별공제에서 어떻게 보는지 — 각 조문 원문으로 확인',
  '2020-877호 정정공고로 추가된 화성시의 효력일(2020-06-19인지 06-29인지)',
  '택지개발지구·행복도시 예정지역 경계(동탄2·광교·고양 택지·세종) — 목록 동·리 안의 주소는 지구 경계를 봐야 함(목록 밖은 아님으로 풀림)',
  '2026-07-01 이후 공고(법제처 연혁 최신: 2026-882호 — 그 뒤 변동은 다시 확인)'
];
var CASEPROC_ADJ_SIDO_ = { '서울특별시': '서울', '서울시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기', '충청북도': '충북', '충청남도': '충남', '전라북도': '전북', '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남' };
function caseProcAdjTok_(addr, t) { return new RegExp('(^|[\\s(,])' + t + '($|[\\s),])').test(addr) || new RegExp('(^|[\\s(,])[^\\s(,]*시' + t + '($|[\\s),])').test(addr); }
// 주소 하나가 공고 한 줄(area)에 드는지 — 'yes' | 'no' | 'unknown'(읍면동·지구 경계를 몰라 못 가름)
function caseProcAdjMatch_(addr, m) {
  const a = ' ' + String(addr || '').replace(/[,·]/g, ' ') + ' ';
  let sd = '';
  Object.keys(CASEPROC_ADJ_SIDO_).forEach(function (k) { if (a.indexOf(k) !== -1) sd = CASEPROC_ADJ_SIDO_[k]; });
  if (!sd) ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기'].forEach(function (k) { if (caseProcAdjTok_(a, k)) sd = k; });
  if (sd && sd !== m.sd) return 'no';
  if (m.si) {
    if (m.si === '세종특별자치시') { if (sd !== '세종') return 'no'; }
    else if (!new RegExp('(^|[\\s(,])' + m.si).test(a)) return 'no'; // 앞이 끊긴 곳에서 시작('남양주시'를 '양주시'로 잡지 않게), 뒤는 '안양시동안구'처럼 붙어도 됨
    if (m.si === '광주시' && sd !== '경기') return sd ? 'no' : 'unknown';
  } else if (!sd) return 'unknown'; // 광역시 구(중구·남구 등)는 시도 없이는 못 가름
  if (m.gu) {
    if (!caseProcAdjTok_(a, m.gu)) {
      // 주소에 다른 구(광역시는 군도)가 있으면 아님, 구가 아예 없으면 못 가름(예: 분구 전 '화성시 오산동')
      const rest = m.si ? (a.split(m.si)[1] || '') : a;
      return (m.si ? /[가-힣]+구(\s|$)/ : /[가-힣]+(구|군)(\s|$)/).test(rest) ? 'no' : 'unknown';
    }
  }
  const toks = a.split(/\s+/).filter(Boolean);
  const dong = toks.filter(function (t) { return /[가-힣0-9]+(동|읍|면|리|가)$/.test(t) && !/(시|구|군)$/.test(t); });
  if (m.only) {
    if (!dong.length) return 'unknown';
    if (!m.only.some(function (x) { return dong.indexOf(x) !== -1; })) return 'no';
    return m.zone ? 'unknown' : 'yes';
  }
  if (m.zone) return 'unknown';
  if (m.ex && m.ex.some(function (x) { return dong.indexOf(x) !== -1; })) return 'no';
  if (m.exRi) {
    const myeon = Object.keys(m.exRi).filter(function (k) { return dong.indexOf(k) !== -1; })[0];
    if (myeon) {
      if (m.exRi[myeon].some(function (x) { return dong.indexOf(x) !== -1; })) return 'no';
      if (!dong.some(function (t) { return /리$/.test(t); })) return 'unknown';
    }
  }
  if ((m.ex || m.exRi) && !dong.length) return 'unknown';
  return 'yes';
}
// 주소·날짜(YYYY-MM-DD)에 조정대상지역이었는지 — { 판정: '조정'|'비조정'|'확인 필요', 이유, 근거: [공고번호…] }
// purpose '거주': 1세대1주택 거주요건(소득세법 시행령 §154①) — §154② "2017년 8월 3일부터 2017년 11월 9일까지의 기간에는 다음 표의 지역을 조정대상지역으로 한다"
//  (표 = 2017-1305호 지역과 같음, 세무사님 해설서 479쪽 "2017.8.3.에 최초 조정대상지역으로 지정된 것으로 의제"). 중과·장기보유특별공제 쪽은 그 조문으로 따로 확인 — 그때는 purpose 없이 불러 '확인 필요'
function caseProcAdjAreaAt_(addr, date, purpose) {
  const d = String(date || '').slice(0, 10);
  if (!addr || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { 판정: '확인 필요', 이유: !addr ? '소재지 없음' : '날짜 없음', 근거: [] };
  let st = false, unk = '', basis = [];
  CASEPROC_ADJ_EVENTS_.forEach(function (e) {
    if (e.date > d) return;
    e.areas.forEach(function (m) {
      const r = caseProcAdjMatch_(addr, m);
      if (r === 'no') return;
      if (r === 'unknown') { unk = e.no + ' ' + e.kind + ' — ' + (m.zone || '주소에 구·읍·면·동이 없어 못 가름'); if (basis.indexOf(e.no) === -1) basis.push(e.no); return; }
      st = e.kind === '지정'; unk = ''; if (basis.indexOf(e.no) === -1) basis.push(e.no);
    });
  });
  // 효력일 확인 필요 구간
  if (d >= '2017-08-03' && d < '2017-11-10') {
    const ms = CASEPROC_ADJ_EVENTS_[0].areas.map(function (m) { return caseProcAdjMatch_(addr, m); });
    if (purpose === '거주' && ms.indexOf('yes') !== -1) return { 판정: '조정', 이유: '소득세법 시행령 §154② — 2017-08-03~11-09는 2017-1305호 지역을 조정대상지역으로 봄(거주요건)', 근거: ['2017-1305', '소령§154②'] };
    if (ms.some(function (x) { return x !== 'no'; })) return { 판정: '확인 필요', 이유: purpose === '거주' ? '§154② 지역 경계(택지지구·예정지역) 확인 필요' : CASEPROC_ADJ_EVENTS_[0].dateNote + ' — 거주요건은 §154②로 조정, 중과·장특공은 그 조문으로 확인', 근거: ['2017-1305'] };
  }
  if (d >= '2020-06-19' && d < '2020-06-29' && caseProcAdjMatch_(addr, { sd: '경기', si: '화성시' }) !== 'no') return { 판정: '확인 필요', 이유: CASEPROC_ADJ_EVENTS_[8].dateNote, 근거: ['2020-877'] };
  if (unk) return { 판정: '확인 필요', 이유: unk, 근거: basis };
  return { 판정: st ? '조정' : '비조정', 이유: (st ? '지정' : basis.length ? '해제' : '지정된 적 없음') + (basis.length ? ' — 공고 ' + basis.join(', ') : '') + (d > '2026-07-01' ? ' (2026-882호 뒤 변동은 다시 확인)' : ''), 근거: basis };
}

// ============================================================
// [2026.10.19 B-5 조견표 세션] AI 지휘 도구 form_needs — 이 사건에 필요한 서식과 서식을 막는 빈 칸(토큰 0, GAS만)
//  색인은 서버 코드가 아니라 드라이브 자료 파일(업무관리자\세금계산\법정서식원본(법제처)\_서식색인.json, tools/build-reftables.js가 씀)에서 읽고 6시간 캐시.
//  칸 종류: input(계산기 입력 — 양도는 calc:a0.필드/calc:c0.필드로 값 유무 확인), result(엔진 결과 — 세액 계산 저장이 있으면 값 있음),
//           screen(화면에서만 넣는 칸 — 서버에서 확인 불가로 따로 셈), none(계산기에 없음 — 서식엔 있지만 계산기가 만들지 않는 칸)
var FORM_INDEX_FOLDER_ = '1bXA_yLVb1Mc6-nGC7nPZXUqKe5ZCAe7M'; // 법정서식원본(법제처)
function formIndexLoad_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('NX_FORM_INDEX_V1');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const it = DriveApp.getFolderById(FORM_INDEX_FOLDER_).getFilesByName('_서식색인.json');
  if (!it.hasNext()) return null;
  const txt = it.next().getBlob().getDataAsString('UTF-8');
  if (txt.length < 95000) { try { cache.put('NX_FORM_INDEX_V1', txt, 21600); } catch (e) {} } // 캐시 한 칸 100KB 한도
  return JSON.parse(txt);
}
function formNeeds_(caseId, input) {
  const idx = formIndexLoad_();
  if (!idx) return { error: '서식 색인(_서식색인.json)을 드라이브에서 못 찾음 — node tools/build-reftables.js 실행 필요' };
  const c = akReadCase_(caseId);
  if (!c) return { error: '사건을 찾지 못함' };
  const sm = c.세목 === 'transfer' || c.세목 === 'gift' || c.세목 === 'inheritance' ? c.세목 : '';
  if (!sm) return { ok: true, 세목: c.세목 || '', 서식: [], 빈칸: [], 안내: '이 세목은 서식 칸 해설이 아직 없음' };
  // 값 출처: 양도 계산기 입력(사건 저장 trCalc), 세액계산 저장 여부
  let st = {};
  try { st = ((caseProcLoad_(caseId) || {}).trCalc || {}).state || {}; } catch (e) { st = {}; }
  const a0 = (st.transferAssets || [])[0] || {}, c0 = (st.transferContracts || [])[0] || {};
  const hasVal = function (t) { const m = /^calc:(a0|c0)\.(.+)$/.exec(t || ''); if (!m) return null; const o = m[1] === 'a0' ? a0 : c0, alt = m[1] === 'a0' ? c0 : a0; const v = o[m[2]] != null && o[m[2]] !== '' ? o[m[2]] : alt[m[2]]; return v != null && v !== '' && v !== false; };
  // 사안에 따라서만 필요한 입력 — 해당 없으면 빈 칸으로 세지 않음(환산 기준시가는 취득가액이 없을 때만, 거주기간은 1세대1주택·주택일 때만)
  const notApplicable = function (t) { const f = String(t || '').replace(/^calc:(a0|c0)./, ''); if (/StandardPriceForConversion$/.test(f)) return !!(a0.acquisitionPrice); if (f === 'residenceYears') return !(a0.isOneHouseOneFamily || a0.assetType === 'house'); return false; };
  const semokName = { transfer: '양도', gift: '증여', inheritance: '상속' }[sm];
  const saved = (c.세액계산결과 || []).some(function (e) { return e && String(e.세목 || '').indexOf(semokName) !== -1; }) || !!(st.transferAssets && st.transferAssets.length && sm === 'transfer' && (caseProcLoad_(caseId) || {}).trCalc);
  const forms = Object.keys(idx.서식).filter(function (no) { return idx.서식[no].세목 === sm; });
  const main = { transfer: /제84호서식(\]| 부표1)/, gift: /제10호서식\]/, inheritance: /제9호서식(\]| 부표1\]| 부표3\])/ }[sm];
  const out = { ok: true, 세목: sm, 세액계산저장: saved, 서식: [], 빈칸: [], 계산기에없음: [], 안내: '' };
  const blanks = [];
  forms.forEach(function (no) {
    const f = idx.서식[no], short = no.replace(/^.*\[/, '').replace(/\]$/, '');
    const n = { 전체: f.칸.length, 값있음: 0, 빈칸: 0, 화면입력확인불가: 0, 계산기에없음: 0 };
    f.칸.forEach(function (k) {
      const kind = k[2], target = k[3];
      const isMain = main.test(no); // 빈 칸·계산기에 없음 목록은 필수 서식(본표·주요 부표)만 — 주식·파생 부표 등은 개수만
      if (kind === 'none') { n.계산기에없음++; if (isMain && out.계산기에없음.length < 15) out.계산기에없음.push({ 서식: short, 칸: k[0] + ' ' + k[1], 이유: k[4] || '계산기에 없음' }); return; }
      if (kind === 'result') { if (saved) n.값있음++; else { n.빈칸++; if (isMain) blanks.push({ 서식: short, 칸: k[0] + ' ' + k[1], 계산기칸: '', 질문id: '', 채울입력: '세액 계산(tax_calc) 뒤에 채워짐' }); } return; }
      if (kind === 'input' && target && notApplicable(target)) { n.해당없음 = (n.해당없음 || 0) + 1; return; }
      if (kind === 'input' && target) { const hv = hasVal(target); if (hv) n.값있음++; else { n.빈칸++; if (isMain) blanks.unshift({ 서식: short, 칸: k[0] + ' ' + k[1], 계산기칸: target, 질문id: target, 채울입력: k[4] || '' }); } return; }
      n.화면입력확인불가++;
    });
    out.서식.push({ 번호: short, 이름: f.이름, 필수: main.test(no), 칸: n });
  });
  out.서식.sort(function (x, y) { return (y.필수 ? 1 : 0) - (x.필수 ? 1 : 0); });
  out.빈칸 = blanks.slice(0, 20); out.빈칸개수 = blanks.length;
  out.안내 = '필수 = 본표·주요 부표(그 밖은 사안에 따라). 빈칸 = 계산기 입력이 비었거나 세액 계산 전. 화면입력확인불가 = 화면에서만 넣는 칸(서버에서 값을 못 봄). 계산기에없음 = 서식엔 있지만 계산기가 만들지 않는 칸(직접 적어야 함).';
  return out;
}

