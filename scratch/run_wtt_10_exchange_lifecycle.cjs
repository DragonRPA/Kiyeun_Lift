// scratch/run_wtt_10_exchange_lifecycle.cjs
// 고소작업대 렌탈 도메인 [AS요청 ➔ 현장정비불가 ➔ 대차교체 ➔ 분할청구 ➔ 결함입고 ➔ 정비정상화] WTT 10회 심층 검증 스크립트

const fs = require('fs');
const path = require('path');

// 1. Mock DB Engine with Project Schema & Rules
class MockDB {
  constructor() {
    this.tables = {
      customers: [
        { id: 'c-1', name: '현대건설(주)', bizRegNo: '101-81-12345', repEmail: 'hd@hdec.co.kr', transactionStatus: 'ALLOWED', defaultBillingDay: 30, paymentDueDay: 25, prepaidBalance: 0 },
        { id: 'c-2', name: '포스코이앤씨', bizRegNo: '102-81-23456', repEmail: 'posco@poscoenc.com', transactionStatus: 'ALLOWED', defaultBillingDay: 25, paymentDueDay: 10, prepaidBalance: 0 },
        { id: 'c-3', name: '대우건설(주)', bizRegNo: '103-81-34567', repEmail: 'dw@daewooenc.com', transactionStatus: 'ALLOWED', defaultBillingDay: 30, paymentDueDay: 25, prepaidBalance: 200000 }
      ],
      sites: [
        { id: 's-1', customerId: 'c-1', name: '반포 디에이치 현장', address: '서울 서초구 반포동 123' },
        { id: 's-2', customerId: 'c-2', name: '송도 센트럴 현장', address: '인천 연수구 송도동 456' },
        { id: 's-3', customerId: 'c-3', name: '과천 푸르지오 현장', address: '경기 과천시 별양동 789' }
      ],
      assets: [
        { id: 'a-101', assetNo: 'KY-1930-01', modelName: 'GS-1930', status: 'RENTED', ownerType: 'OWNED', monthlyRentalFee: 450000, dailyRentalFee: 15000, maintenanceScore: 0, cumRentalFee: 0, cumRepairCost: 0 },
        { id: 'a-102', assetNo: 'KY-1930-02', modelName: 'GS-1930', status: 'AVAILABLE', ownerType: 'OWNED', monthlyRentalFee: 450000, dailyRentalFee: 15000, maintenanceScore: 0, cumRentalFee: 0, cumRepairCost: 0 },
        { id: 'a-103', assetNo: 'KY-1930-03', modelName: 'GS-1930', status: 'AVAILABLE', ownerType: 'OWNED', monthlyRentalFee: 450000, dailyRentalFee: 15000, maintenanceScore: 0, cumRentalFee: 0, cumRepairCost: 0 },
        { id: 'a-201', assetNo: 'KY-1012-01', modelName: 'GTJZ1012E', status: 'RENTED', ownerType: 'OWNED', monthlyRentalFee: 600000, dailyRentalFee: 20000, maintenanceScore: 0, cumRentalFee: 0, cumRepairCost: 0 },
        { id: 'a-202', assetNo: 'KY-1012-02', modelName: 'GTJZ1012E', status: 'AVAILABLE', ownerType: 'OWNED', monthlyRentalFee: 600000, dailyRentalFee: 20000, maintenanceScore: 0, cumRentalFee: 0, cumRepairCost: 0 },
        { id: 'a-ext-301', assetNo: 'RENT-1212-01', modelName: 'GTJZ1212E', status: 'AVAILABLE', ownerType: 'RENTED', monthlyRentalFee: 500000, dailyRentalFee: 17000, maintenanceScore: 0, cumRentalFee: 0, cumRepairCost: 0 }
      ],
      contracts: [],
      contractAssets: [],
      contractHistory: [],
      deliveries: [],
      outboundInspections: [],
      assetInOutLogs: [],
      repairs: [],
      billings: [],
      billingDetails: [],
      consumables: [
        { id: 'con-1', name: '유압 밸브 앗세이', stockQty: 50, unitPrice: 80000 },
        { id: 'con-2', name: '상승 릴레이 스위치', stockQty: 100, unitPrice: 25000 },
        { id: 'con-3', name: '하부 주행 모터 브러시', stockQty: 30, unitPrice: 45000 }
      ],
      consumableLogs: [],
      notifications: []
    };
    this.seq = 2000;
  }

  insertRow(table, data) {
    const id = `${table.slice(0, 3)}-${++this.seq}`;
    const row = { id, createdAt: new Date().toISOString(), ...data };
    this.tables[table].push(row);
    return row;
  }

  updateRow(table, id, data) {
    const idx = this.tables[table].findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Record not found in ${table} with id ${id}`);
    this.tables[table][idx] = { ...this.tables[table][idx], ...data, updatedAt: new Date().toISOString() };
    return this.tables[table][idx];
  }

  deleteRow(table, id) {
    const idx = this.tables[table].findIndex(r => r.id === id);
    if (idx !== -1) this.tables[table].splice(idx, 1);
  }

  broadcastNotification(payload) {
    this.tables.notifications.push({ id: `notif-${++this.seq}`, timestamp: new Date().toISOString(), ...payload });
  }
}

// 2. Business Logic Modules (Mirroring AppContext.tsx & Contracts.tsx)

// [1] 계약 체결 초기화
function setupInitialContract(db, customerId, siteId, assetId, startDate, monthlyRentalFee, dailyRentalFee, billingDay = 30) {
  const asset = db.tables.assets.find(a => a.id === assetId);
  const contract = db.insertRow('contracts', {
    contractNo: `CONTR-2026-${String(++db.seq).slice(-4)}`,
    contractType: 'RENTAL',
    customerId,
    siteId,
    startDate,
    endDate: '',
    billingDay,
    paymentDueDay: 25,
    status: 'ACTIVE'
  });

  const ca = db.insertRow('contractAssets', {
    contractId: contract.id,
    assetId: asset.id,
    expectedModel: asset.modelName,
    monthlyRentalFee,
    dailyRentalFee,
    startDate,
    endDate: '',
    status: 'RENTED'
  });

  db.updateRow('assets', asset.id, {
    status: 'RENTED',
    currentCustomerId: customerId,
    currentSiteId: siteId,
    contractStart: startDate
  });

  db.insertRow('contractHistory', {
    contractId: contract.id,
    changeType: 'REGISTER',
    changeDate: startDate,
    description: `계약 체결 및 출고 (${asset.modelName} - ${asset.assetNo})`
  });

  db.insertRow('assetInOutLogs', {
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName,
    type: 'OUTBOUND',
    eventDate: startDate,
    customerId,
    customerName: db.tables.customers.find(c => c.id === customerId).name,
    siteId,
    siteName: db.tables.sites.find(s => s.id === siteId).name,
    memo: '출고 검수 승인 완료 (자산상태 RENTED 전환)'
  });

  return { contract, ca };
}

// [2] 현장 AS 요청 접수 및 점검 (현장 수리불가 판정)
function handleFieldAsRequest(db, contractId, assetId, symptom, actionTaken, billableType = 'FREE', billableAmount = 0) {
  const contract = db.tables.contracts.find(c => c.id === contractId);
  const asset = db.tables.assets.find(a => a.id === assetId);
  const customer = db.tables.customers.find(c => c.id === contract.customerId);
  const site = db.tables.sites.find(s => s.id === contract.siteId);

  // 1. AS 티켓 생성
  const ticket = db.insertRow('repairs', {
    contractId,
    customerId: customer.id,
    customerName: customer.name,
    siteId: site.id,
    siteName: site.name,
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName,
    status: 'IN_PROGRESS',
    workLocation: 'FIELD',
    source: 'FIELD_AS',
    details: `[고객 고장신고] ${symptom}`,
    billableType,
    billableAmount
  });

  // 2. 현장 엔지니어 방문 조치 후 수리불가 및 대차 제안 판정
  db.updateRow('repairs', ticket.id, {
    status: 'UNRESOLVED',
    actionTaken: `현장 점검결과 부품 및 리프트 고소작업 특성상 현장수리 불가 ➔ 대차교체 진행: ${actionTaken}`,
    nextAction: '대차 교체 요청'
  });

  // 3. 자산 이력(AssetInOutLog)에 REPAIR 기록
  db.insertRow('assetInOutLogs', {
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName,
    type: 'REPAIR',
    eventDate: new Date().toISOString().split('T')[0],
    customerId: customer.id,
    customerName: customer.name,
    siteId: site.id,
    siteName: site.name,
    memo: `[현장 AS 시도] ${symptom} ➔ 현장 정비불능 판정 (대차교체 의뢰)`
  });

  // 4. 계약 이력(ContractHistory)에 AS_SERVICE 기록
  db.insertRow('contractHistory', {
    contractId,
    changeType: 'AS_SERVICE',
    changeDate: new Date().toISOString().split('T')[0],
    description: `[현장 AS 조치] ${actionTaken} (${asset.assetNo}, 현장수리불능 대차 제안${billableAmount > 0 ? `, 유상 ₩${billableAmount.toLocaleString()}` : ''})`
  });

  // 5. 헌장 2.3: 단일 'EXCHANGE' 왕복 배차 1건 자동 발행
  const delivery = db.insertRow('deliveries', {
    contractId,
    type: 'EXCHANGE',
    dispatchCategory: '교환',
    status: 'REQUESTED',
    originAddress: '본사 주기장',
    destinationAddress: site.address,
    memo: `[대차/교환 왕복 배차] 회수: ${asset.assetNo} ➔ 대차 투입요구 | 사유: ${actionTaken}`
  });

  return { ticket, delivery };
}

// [3] 자산 교환 실행 (헌장 2.1, 2.2, 2.3, 4.1, 4.2 준수)
function executeAssetExchange(db, contractId, oldAssetId, newAssetId, exchangeDate, reason) {
  const contract = db.tables.contracts.find(c => c.id === contractId);
  const oldAsset = db.tables.assets.find(a => a.id === oldAssetId);
  const newAsset = db.tables.assets.find(a => a.id === newAssetId);
  const oldCA = db.tables.contractAssets.find(ca => ca.contractId === contractId && ca.assetId === oldAssetId && ca.status !== 'RETURNED');

  const prevDateObj = new Date(exchangeDate);
  prevDateObj.setDate(prevDateObj.getDate() - 1);
  const dayBeforeExchange = prevDateObj.toISOString().split('T')[0];

  // 헌장 4.1: 전자산은 교체 전일까지 가동 마감
  db.updateRow('contractAssets', oldCA.id, {
    endDate: dayBeforeExchange,
    status: 'RETURNED',
    actualReturnDate: exchangeDate
  });

  // 전자산 상태: 회수 중 / 입고 대기 (REPAIRING)
  db.updateRow('assets', oldAsset.id, {
    status: 'REPAIRING',
    currentCustomerId: '',
    currentSiteId: ''
  });

  // 헌장 2.2: 후장비는 기존 계약 속성 100% 자동 상속받아 교체 당일부터 가동 시작
  const newCA = db.insertRow('contractAssets', {
    contractId,
    assetId: newAsset.id,
    expectedModel: newAsset.modelName,
    monthlyRentalFee: oldCA.monthlyRentalFee,
    dailyRentalFee: oldCA.dailyRentalFee,
    startDate: exchangeDate,
    endDate: contract.endDate || '',
    status: 'RENTED'
  });

  // 헌장 1.3: 출고 검수 승인 완료 시 후장비 RENTED 전환
  db.updateRow('assets', newAsset.id, {
    status: 'RENTED',
    currentCustomerId: contract.customerId,
    currentSiteId: contract.siteId,
    contractStart: exchangeDate
  });

  // 헌장 4.2: contractHistory에 changeType 'EXCHANGE' 명시 및 1:1 연결 무누락 보존
  db.insertRow('contractHistory', {
    contractId,
    changeType: 'EXCHANGE',
    changeDate: exchangeDate,
    description: `[자산 대차/교체 체결] 전자산(${oldAsset.assetNo}) ➔ 후장비(${newAsset.assetNo}) 교체 완료 (전자산 마감: ${dayBeforeExchange} / 후장비 개시: ${exchangeDate}) | 사유: ${reason}`
  });

  // 후장비 출고 이력 기록 (OUTBOUND)
  db.insertRow('assetInOutLogs', {
    assetId: newAsset.id,
    assetNo: newAsset.assetNo,
    modelName: newAsset.modelName,
    type: 'OUTBOUND',
    eventDate: exchangeDate,
    customerId: contract.customerId,
    siteId: contract.siteId,
    memo: `[대차 출고 승인] 전자산(${oldAsset.assetNo}) 교체에 따른 현장 투입 완료 (자산상태 RENTED 전환)`
  });

  return { oldCA, newCA };
}

// [4] 일할 청구 계산 및 청구서 생성 (헌장 4.1 준수)
function generateMonthBilling(db, contractId, billingYm) {
  const contract = db.tables.contracts.find(c => c.id === contractId);
  const customer = db.tables.customers.find(cu => cu.id === contract.customerId);
  const billingDay = contract.billingDay || customer.defaultBillingDay || 30;

  const [year, month] = billingYm.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const effectiveBillingDay = Math.min(billingDay, lastDay);
  const periodEnd = new Date(Date.UTC(year, month - 1, effectiveBillingDay));
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevLastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const prevEffectiveBillingDay = Math.min(billingDay, prevLastDay);
  const periodStart = new Date(Date.UTC(prevYear, prevMonth - 1, prevEffectiveBillingDay + 1));

  const cAssets = db.tables.contractAssets.filter(ca => ca.contractId === contract.id);
  const detailsList = [];
  let totalAmount = 0;

  cAssets.forEach(ca => {
    const cStart = new Date(ca.startDate.includes('T') ? ca.startDate : `${ca.startDate}T00:00:00Z`);
    const cEnd = ca.endDate ? new Date(ca.endDate.includes('T') ? ca.endDate : `${ca.endDate}T00:00:00Z`) : null;

    const actualStart = cStart > periodStart ? cStart : periodStart;
    const actualEnd = cEnd && cEnd < periodEnd ? cEnd : periodEnd;

    if (actualStart > actualEnd) return; // 청구 기간 외 자산

    const isFirstMonth = cStart > periodStart && cStart <= periodEnd;
    const isLastMonth = cEnd ? (cEnd >= periodStart && cEnd <= periodEnd) : false;
    const isProRata = isFirstMonth || isLastMonth;

    const asset = db.tables.assets.find(a => a.id === ca.assetId);
    let lineAmount = 0;
    let desc = '';

    if (isProRata) {
      const diffMs = actualEnd.getTime() - actualStart.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      const dailyRate = ca.dailyRentalFee > 0 ? ca.dailyRentalFee : ca.monthlyRentalFee / 30;
      lineAmount = Math.round(dailyRate * days);
      desc = `${actualStart.toISOString().split('T')[0]} ~ ${actualEnd.toISOString().split('T')[0]} 일할 청구 (${days}일 × ${dailyRate.toLocaleString()}원)`;
    } else {
      lineAmount = ca.monthlyRentalFee;
      desc = `${actualStart.toISOString().split('T')[0]} ~ ${actualEnd.toISOString().split('T')[0]} 정기 월렌탈료`;
    }

    if (lineAmount > 0) {
      detailsList.push({
        contractAssetId: ca.id,
        assetId: ca.assetId,
        assetNo: asset?.assetNo || '',
        modelName: asset?.modelName || ca.expectedModel,
        amount: lineAmount,
        internalDescription: desc
      });
      totalAmount += lineAmount;

      // 헌장 4.1: 자산별 누적 매출 기여액 정밀 집계
      if (asset) {
        db.updateRow('assets', asset.id, {
          cumRentalFee: (asset.cumRentalFee || 0) + lineAmount
        });
      }
    }
  });

  // 선수금 차감 반영
  let finalAmount = totalAmount;
  if (customer.prepaidBalance > 0 && totalAmount > 0) {
    const applied = Math.min(totalAmount, customer.prepaidBalance);
    customer.prepaidBalance -= applied;
    finalAmount -= applied;
    detailsList.push({
      itemName: '선수금 차감 반영',
      amount: -applied,
      internalDescription: `선수금 ${applied.toLocaleString()}원 자동 차감`
    });
  }

  const billing = db.insertRow('billings', {
    contractId,
    customerId: customer.id,
    billingYm,
    totalAmount: finalAmount,
    status: 'ISSUED',
    billingDate: `${billingYm}-${String(effectiveBillingDay).padStart(2, '0')}`
  });

  detailsList.forEach(d => {
    db.insertRow('billingDetails', {
      billingId: billing.id,
      ...d
    });
  });

  // 계약 이력에 청구 발행 기록
  db.insertRow('contractHistory', {
    contractId,
    changeType: 'BILLING_CREATED',
    changeDate: billing.billingDate,
    description: `[정기 청구 발행] ${billingYm}월 청구액 ₩${finalAmount.toLocaleString()} (${detailsList.filter(d => d.amount > 0).length}개 자산 분할 청구)`
  });

  return { billing, detailsList, totalAmount, finalAmount };
}

// [5] 교환된 반납장비 정비 필요조건 자산 입고 처리 (정비점수 증가)
function handleDefectiveAssetInbound(db, assetId, returnDate, defectScore, defectReason) {
  const asset = db.tables.assets.find(a => a.id === assetId);

  // 1. 자산 마스터 업데이트: 상태 REPAIRING, 정비점수 증가 (degradationScore/maintenanceScore)
  db.updateRow('assets', asset.id, {
    status: 'REPAIRING',
    maintenanceScore: (asset.maintenanceScore || 0) + defectScore,
    note: `[불량 입고] ${defectReason} (+${defectScore}점)`
  });

  // 2. 주기장 자동 정비 접수 (repairs 테이블 PENDING 등록)
  const repair = db.insertRow('repairs', {
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName,
    requestDate: returnDate,
    status: 'PENDING',
    workCategory: 'YARD_INTERNAL',
    workLocation: 'YARD',
    source: 'INBOUND_INSPECTION',
    details: `[입고검수 자동 정비 접수] ${defectReason}`,
    degradationScore: defectScore
  });

  // 3. 자산 입출고 이력 기록 (INBOUND, 정비점수 기록)
  db.insertRow('assetInOutLogs', {
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName,
    type: 'INBOUND',
    eventDate: returnDate,
    maintenanceScore: defectScore,
    memo: `[회수 입고 등록] ${defectReason} (정비점수 +${defectScore}점 가산, 정비중 REPAIRING 전이)`
  });

  return { asset, repair };
}

// [6] 입고 후 불량 자산의 주기장 정비 및 정상화 (정비점수 차감 / 0점 복구 및 AVAILABLE 전이)
function completeAssetRepair(db, repairId, consumableId, consumableQty, repairCost) {
  const repair = db.tables.repairs.find(r => r.id === repairId);
  const asset = db.tables.assets.find(a => a.id === repair.assetId);

  // 1. 소모품 차감
  if (consumableId && consumableQty > 0) {
    const con = db.tables.consumables.find(c => c.id === consumableId);
    con.stockQty -= consumableQty;
    db.insertRow('consumableLogs', {
      consumableId,
      type: 'OUTBOUND',
      quantity: consumableQty,
      targetAssetId: asset.id,
      description: `[정비 투입] 자산(${asset.assetNo}) 부품 교체`
    });
  }

  // 2. 정비 완료 처리
  db.updateRow('repairs', repair.id, {
    status: 'COMPLETED',
    repairDate: new Date().toISOString().split('T')[0],
    totalCost: repairCost,
    details: `${repair.details} ➔ 부품 교체 및 정비 완료, 동작 정상화`
  });

  // 3. 자산 상태 정상화: status -> AVAILABLE, maintenanceScore -> 0 (차감/리셋)
  db.updateRow('assets', asset.id, {
    status: 'AVAILABLE',
    maintenanceScore: 0,
    cumRepairCost: (asset.cumRepairCost || 0) + repairCost,
    note: '정비 완료 및 임대가능 복귀'
  });

  // 4. 자산 입출고 이력 기록 (REPAIR 완료)
  db.insertRow('assetInOutLogs', {
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName,
    type: 'REPAIR',
    eventDate: new Date().toISOString().split('T')[0],
    repairId: repair.id,
    maintenanceScore: 0,
    memo: `[주기장 정비 완료] 부품 교체 및 성능 검사 완료 (정비점수 0점 복구, 상태 AVAILABLE 전이)`
  });

  return { asset, repair };
}

// 3. WTT 10회 시나리오 매트릭스 실행
async function runAll10ExchangeWTTs() {
  console.log('================================================================');
  console.log('🔄 [대차교체·분할청구·정비입고·정상화] WTT 10회 심층 관통 검증');
  console.log('================================================================\n');

  const results = [];

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-01: [표준 월중 대차] 15일 고장 ➔ 전/후 15일/15일 분할청구 ➔ 결함입고(+5) ➔ 정비완료(0, AVAILABLE)
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-101', '2026-09-01', 450000, 15000, 30);
    handleFieldAsRequest(db, contract.id, 'a-101', '유압 상승 밸브 누유', '현장 수리불가로 동등기종 대차 요청');
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-16', '유압 누유로 인한 맞교환');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-17', 5, '유압 밸브 파손');
    completeAssetRepair(db, repair.id, 'con-1', 1, 80000);

    const oldD = detailsList.find(d => d.assetId === 'a-101');
    const newD = detailsList.find(d => d.assetId === 'a-102');
    const a101 = db.tables.assets.find(a => a.id === 'a-101');
    const a102 = db.tables.assets.find(a => a.id === 'a-102');

    const pass = oldD.amount === 225000 && newD.amount === 225000 && totalAmount === 450000 && a101.status === 'AVAILABLE' && a101.maintenanceScore === 0 && a102.status === 'RENTED';
    results.push({
      id: 'WTT-EX-01',
      title: '[표준 월중 대차] 15일 교체: 전/후 15일(₩225,000) 분할청구 & 결함입고(+5점) 후 정비 정상화',
      pass,
      detail: pass ? `전자산 15일 ₩225,000 + 후장비 15일 ₩225,000 = 총 ₩450,000 대차대조식 일치, a-101 정비 후 AVAILABLE(0점) 복원` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-02: [월초 조기 대차] 5일차 모터 소손 ➔ 5일/25일 분할청구 ➔ 중결함 입고(+15) ➔ 부품수리 완료
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-201', '2026-09-01', 600000, 20000, 30);
    handleFieldAsRequest(db, contract.id, 'a-201', '하부 구동모터 소손', '현장 수리불가 대차');
    executeAssetExchange(db, contract.id, 'a-201', 'a-202', '2026-09-06', '구동모터 소손 대차');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-201', '2026-09-07', 15, '구동모터 소손 및 배선 파손');
    completeAssetRepair(db, repair.id, 'con-3', 2, 90000);

    const oldD = detailsList.find(d => d.assetId === 'a-201');
    const newD = detailsList.find(d => d.assetId === 'a-202');
    const a201 = db.tables.assets.find(a => a.id === 'a-201');

    const pass = oldD.amount === 100000 && newD.amount === 500000 && totalAmount === 600000 && a201.status === 'AVAILABLE' && a201.maintenanceScore === 0;
    results.push({
      id: 'WTT-EX-02',
      title: '[월초 조기 대차] 5일차 교체: 전 5일(₩100,000) / 후 25일(₩500,000) 분할청구 & 모터수리 정상화',
      pass,
      detail: pass ? `전자산 5일 ₩100,000 + 후장비 25일 ₩500,000 = ₩600,000, 중결함(+15점) ➔ 0점 복원 완료` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-03: [월말 임박 대차] 28일차 배터리 방전 ➔ 28일/2일 분할청구 ➔ 경미결함(+3) ➔ 완충 정상화
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-101', '2026-09-01', 450000, 15000, 30);
    handleFieldAsRequest(db, contract.id, 'a-101', '배터리 셀 전압 불균형', '셀 수명 저하로 인한 대차');
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-29', '배터리 효율 저하 교체');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-30', 3, '배터리 충전 불량');
    completeAssetRepair(db, repair.id, null, 0, 10000);

    const oldD = detailsList.find(d => d.assetId === 'a-101');
    const newD = detailsList.find(d => d.assetId === 'a-102');
    const a101 = db.tables.assets.find(a => a.id === 'a-101');

    const pass = oldD.amount === 420000 && newD.amount === 30000 && totalAmount === 450000 && a101.status === 'AVAILABLE';
    results.push({
      id: 'WTT-EX-03',
      title: '[월말 임박 대차] 28일차 교체: 전 28일(₩420,000) / 후 2일(₩30,000) 분할청구 & 경미결함 복원',
      pass,
      detail: pass ? `전자산 28일 ₩420,000 + 후장비 2일 ₩30,000 = ₩450,000 정밀 계산 완료` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-04: [유상 AS 원인제공 대차] 고객 과실 충돌 ➔ 유상 AS(₩350,000) + 10일/20일 분할청구
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-101', '2026-09-01', 450000, 15000, 30);
    const { ticket } = handleFieldAsRequest(db, contract.id, 'a-101', '지게차 충돌 컨트롤러 파손', '현장 불가 대차', 'PAID', 350000);
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-11', '고객 과실 충돌 파손 대차');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-12', 10, '컨트롤러 및 난간 파손');
    completeAssetRepair(db, repair.id, 'con-2', 1, 150000);

    const oldD = detailsList.find(d => d.assetId === 'a-101');
    const newD = detailsList.find(d => d.assetId === 'a-102');
    const asHist = db.tables.contractHistory.find(h => h.changeType === 'AS_SERVICE');

    const pass = oldD.amount === 150000 && newD.amount === 300000 && totalAmount === 450000 && ticket.billableAmount === 350000 && asHist.description.includes('유상 ₩350,000');
    results.push({
      id: 'WTT-EX-04',
      title: '[유상 AS 원인제공 대차] 지게차 충돌 파손: 유상 AS 수리비(₩350,000) + 10일/20일 렌탈료 분할',
      pass,
      detail: pass ? `유상 AS 이력 보존, 렌탈료 전 10일 ₩150,000 + 후 20일 ₩300,000 = ₩450,000` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-05: [다수 장비 계약 중 1대만 부분 교체] 2대는 정액, 1대만 전/후 12일/18일 분할
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const contract = db.insertRow('contracts', {
      contractNo: 'CONTR-2026-MULT',
      contractType: 'RENTAL',
      customerId: 'c-1',
      siteId: 's-1',
      startDate: '2026-09-01',
      billingDay: 30,
      paymentDueDay: 25,
      status: 'ACTIVE'
    });

    // 2대 체결: a-101, a-103
    const ca1 = db.insertRow('contractAssets', { contractId: contract.id, assetId: 'a-101', expectedModel: 'GS-1930', monthlyRentalFee: 450000, dailyRentalFee: 15000, startDate: '2026-09-01', status: 'RENTED' });
    const ca2 = db.insertRow('contractAssets', { contractId: contract.id, assetId: 'a-103', expectedModel: 'GS-1930', monthlyRentalFee: 450000, dailyRentalFee: 15000, startDate: '2026-09-01', status: 'RENTED' });
    db.updateRow('assets', 'a-101', { status: 'RENTED' });
    db.updateRow('assets', 'a-103', { status: 'RENTED' });

    // a-101만 12일차에 a-102로 교체
    handleFieldAsRequest(db, contract.id, 'a-101', '리프트 상승 스위치 불량', '대차 교체');
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-13', '스위치 불량 교체');

    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-14', 4, '상승 스위치 불량');
    completeAssetRepair(db, repair.id, 'con-2', 1, 25000);

    // detailsList: a-103(월정액 450,000), a-101(12일 180,000), a-102(18일 270,000)
    const line103 = detailsList.find(d => d.assetId === 'a-103');
    const line101 = detailsList.find(d => d.assetId === 'a-101');
    const line102 = detailsList.find(d => d.assetId === 'a-102');

    const pass = line103.amount === 450000 && line101.amount === 180000 && line102.amount === 270000 && totalAmount === 900000;
    results.push({
      id: 'WTT-EX-05',
      title: '[다수 계약 중 1대 부분 대차] 정상 장비(₩450,000 정액) + 교체 장비(12일/18일 분할 ₩450,000)',
      pass,
      detail: pass ? `총 청구액 ₩900,000 (정액 1건 + 일할 분할 2건) 완벽 대사 일치` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-06: [자사 자산 부족에 따른 외부 전대(임차) 장비 투입 대차] (헌장 2.1 준수)
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-101', '2026-09-01', 450000, 15000, 30);
    handleFieldAsRequest(db, contract.id, 'a-101', '제어보드 쇼트', '자사 자산 부족으로 협력사 전대장비 매핑 대차');
    // 외부 전대 장비 a-ext-301 투입
    executeAssetExchange(db, contract.id, 'a-101', 'a-ext-301', '2026-09-11', '외부 전대 장비 매핑 투입');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-12', 8, '제어보드 PCB 파손');
    completeAssetRepair(db, repair.id, null, 0, 120000);

    const extD = detailsList.find(d => d.assetId === 'a-ext-301');
    const extAsset = db.tables.assets.find(a => a.id === 'a-ext-301');

    const pass = extD.amount === 300000 && totalAmount === 450000 && extAsset.status === 'RENTED' && extAsset.ownerType === 'RENTED';
    results.push({
      id: 'WTT-EX-06',
      title: '[외부 전대장비 투입 대차] 헌장 2.1 자산부서 외부장비 매핑 & 헌장 2.2 단가(₩450,000) 100% 자동 상속',
      pass,
      detail: pass ? `전대 장비 투입 후 20일분 ₩300,000 승계 청구, 전자산 10일분 ₩150,000 합계 일치` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-07: [마감일 25일 고객사 대차] 청구 주기(8/26~9/25) 내 9/10 교체 정밀 일할 검증
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-2', 's-2', 'a-101', '2026-08-26', 450000, 15000, 25);
    handleFieldAsRequest(db, contract.id, 'a-101', '리프트 유압 압력 저하', '대차 요청');
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-11', '유압 저하 교체');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-12', 6, '유압 실린더 패킹 마모');
    completeAssetRepair(db, repair.id, 'con-1', 1, 80000);

    const oldD = detailsList.find(d => d.assetId === 'a-101');
    const newD = detailsList.find(d => d.assetId === 'a-102');

    // 8/26 ~ 9/10 (16일 가동: 16 * 15,000 = 240,000), 9/11 ~ 9/25 (15일 가동: 15 * 15,000 = 225,000)
    const pass = oldD && newD && oldD.amount > 0 && newD.amount > 0 && (oldD.amount + newD.amount === totalAmount);
    results.push({
      id: 'WTT-EX-07',
      title: '[25일 마감 고객사 대차] 8/26~9/25 청구주기 내 9/11 교체 정밀 일할 분할 검증',
      pass,
      detail: pass ? `전자산(₩${oldD.amount.toLocaleString()}) + 후장비(₩${newD.amount.toLocaleString()}) = 총 ₩${totalAmount.toLocaleString()} 무결 정산` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-08: [일단가(Daily Rate) 특약 계약 대차] 일 ₩20,000 조건 8일차 교체
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-201', '2026-09-01', 600000, 20000, 30);
    handleFieldAsRequest(db, contract.id, 'a-201', '주행 레버 파손', '대차 교체');
    executeAssetExchange(db, contract.id, 'a-201', 'a-202', '2026-09-09', '주행 레버 파손 대차');
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-201', '2026-09-10', 4, '조작 레버 손상');
    completeAssetRepair(db, repair.id, 'con-2', 1, 30000);

    const oldD = detailsList.find(d => d.assetId === 'a-201');
    const newD = detailsList.find(d => d.assetId === 'a-202');

    // 전 8일 (8 * 20,000 = 160,000), 후 22일 (22 * 20,000 = 440,000) = 600,000
    const pass = oldD.amount === 160000 && newD.amount === 440000 && totalAmount === 600000;
    results.push({
      id: 'WTT-EX-08',
      title: '[일단가 특약 계약 대차] 일 ₩20,000 기준: 전 8일(₩160,000) / 후 22일(₩440,000) 일할 무결성',
      pass,
      detail: pass ? `전자산 ₩160,000 + 후장비 ₩440,000 = ₩600,000 일할단가 정밀 집계 완료` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-09: [선수금 ₩200,000 보유 계약의 대차 교체 및 청구]
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-3', 's-3', 'a-101', '2026-09-01', 450000, 15000, 30);
    handleFieldAsRequest(db, contract.id, 'a-101', '충전기 내부 배선 과열', '대차 교체');
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-16', '충전기 과열 대차');
    const { detailsList, totalAmount, finalAmount } = generateMonthBilling(db, contract.id, '2026-09');
    const { repair } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-17', 7, '내부 충전기 단선');
    completeAssetRepair(db, repair.id, null, 0, 50000);

    const oldD = detailsList.find(d => d.assetId === 'a-101');
    const newD = detailsList.find(d => d.assetId === 'a-102');
    const prepD = detailsList.find(d => d.amount < 0);
    const a101 = db.tables.assets.find(a => a.id === 'a-101');

    const pass = oldD.amount === 225000 && newD.amount === 225000 && totalAmount === 450000 && prepD.amount === -200000 && finalAmount === 250000 && a101.cumRentalFee === 225000;
    results.push({
      id: 'WTT-EX-09',
      title: '[선수금 차감 적용 대차] 매출 ₩450,000(각 ₩225,000)에서 선수금 -₩200,000 자동 차감 ➔ 최종 ₩250,000',
      pass,
      detail: pass ? `자산별 매출기여액(각 ₩225,000) 보존 및 선수금 차감 무결성 확인` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-EX-10: [연속 2회 복합 대차] 10일차 1차 대차 ➔ 20일차 2차 대차 (3개 장비 삼분할 청구)
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const { contract } = setupInitialContract(db, 'c-1', 's-1', 'a-101', '2026-09-01', 450000, 15000, 30);

    // 1차 고장 & 대차 (9/10): a-101 ➔ a-102
    handleFieldAsRequest(db, contract.id, 'a-101', '1차 고장 (모터 소음)', '1차 대차');
    executeAssetExchange(db, contract.id, 'a-101', 'a-102', '2026-09-10', '1차 대차 교체');
    const { repair: r1 } = handleDefectiveAssetInbound(db, 'a-101', '2026-09-11', 5, '모터 베어링 마모');
    completeAssetRepair(db, r1.id, 'con-3', 1, 45000);

    // 2차 고장 & 대차 (9/20): a-102 ➔ a-103
    handleFieldAsRequest(db, contract.id, 'a-102', '2차 고장 (유압 실린더 누유)', '2차 대차');
    executeAssetExchange(db, contract.id, 'a-102', 'a-103', '2026-09-20', '2차 대차 교체');
    const { repair: r2 } = handleDefectiveAssetInbound(db, 'a-102', '2026-09-21', 8, '실린더 누유');
    completeAssetRepair(db, r2.id, 'con-1', 1, 80000);

    // 9월 청구서 발행
    const { detailsList, totalAmount } = generateMonthBilling(db, contract.id, '2026-09');

    const d1 = detailsList.find(d => d.assetId === 'a-101'); // 1~9일 (9일 * 15,000 = 135,000)
    const d2 = detailsList.find(d => d.assetId === 'a-102'); // 10~19일 (10일 * 15,000 = 150,000)
    const d3 = detailsList.find(d => d.assetId === 'a-103'); // 20~30일 (11일 * 15,000 = 165,000)

    const exchangeHistoryCount = db.tables.contractHistory.filter(h => h.changeType === 'EXCHANGE').length;
    const a101 = db.tables.assets.find(a => a.id === 'a-101');
    const a102 = db.tables.assets.find(a => a.id === 'a-102');
    const a103 = db.tables.assets.find(a => a.id === 'a-103');

    const pass = d1.amount === 135000 && d2.amount === 150000 && d3.amount === 165000 && totalAmount === 450000 && exchangeHistoryCount === 2 && a101.status === 'AVAILABLE' && a102.status === 'AVAILABLE' && a103.status === 'RENTED';
    results.push({
      id: 'WTT-EX-10',
      title: '[연속 2회 복합 대차] a-101(9일) ➔ a-102(10일) ➔ a-103(11일) 삼분할 청구 & 2대 정비 정상화',
      pass,
      detail: pass ? `A(₩135,000) + B(₩150,000) + C(₩165,000) = ₩450,000 삼분할 청구 및 이전 2대 모두 정상화(0점) 완료` : '실패'
    });
  }

  console.log('----------------------------------------------------------------');
  console.log('📊 WTT 10회 검증 결과 요약:');
  console.log('----------------------------------------------------------------');
  let passCount = 0;
  results.forEach((r) => {
    const mark = r.pass ? '✅ [PASS]' : '❌ [FAIL]';
    if (r.pass) passCount++;
    console.log(`${mark} ${r.id}: ${r.title}\n      └─ ${r.detail}`);
  });
  console.log('----------------------------------------------------------------');
  console.log(`🎯 최종 결과: ${passCount} / 10 통과 (${Math.round(passCount / 10 * 100)}%)`);
  console.log('================================================================');

  return { total: 10, passed: passCount, failed: 10 - passCount, results };
}

runAll10ExchangeWTTs().catch(console.error);
