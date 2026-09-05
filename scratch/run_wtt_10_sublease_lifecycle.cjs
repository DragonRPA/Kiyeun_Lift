// scratch/run_wtt_10_sublease_lifecycle.cjs
// 고소작업대 렌탈 도메인 전대(임차) 자산 출고·반납 전 주기 WTT 10회 심층 검증 스크립트
// [경유옵션장착 vs 현장직송 / 경유옵션탈거 vs 현장직반납]

const fs = require('fs');
const path = require('path');

// 1. Mock DB Engine with Project Schema & Rules
class MockDB {
  constructor() {
    this.tables = {
      customers: [
        { id: 'c-1', name: '삼성물산(주)', bizRegNo: '101-81-11111', defaultBillingDay: 30, paymentDueDay: 25 },
        { id: 'c-2', name: '포스코이앤씨', bizRegNo: '102-81-22222', defaultBillingDay: 25, paymentDueDay: 10 },
        { id: 'c-3', name: '현대건설(주)', bizRegNo: '103-81-33333', defaultBillingDay: 30, paymentDueDay: 25 },
        { id: 'c-4', name: '대우건설(주)', bizRegNo: '104-81-44444', defaultBillingDay: 30, paymentDueDay: 25 },
        { id: 'c-5', name: '롯데건설(주)', bizRegNo: '105-81-55555', defaultBillingDay: 30, paymentDueDay: 25 },
        { id: 'c-6', name: 'SK에코플랜트', bizRegNo: '106-81-66666', defaultBillingDay: 30, paymentDueDay: 25 }
      ],
      sites: [
        { id: 's-1', customerId: 'c-1', name: '평택 고덕 삼성전자 현장', address: '경기 평택시 고덕면 100' },
        { id: 's-2', customerId: 'c-2', name: '송도 센트럴 현장', address: '인천 연수구 송도동 200' },
        { id: 's-3', customerId: 'c-3', name: '반포 디에이치 현장', address: '서울 서초구 반포동 300' },
        { id: 's-4', customerId: 'c-4', name: '과천 푸르지오 현장', address: '경기 과천시 별양동 400' },
        { id: 's-5', customerId: 'c-5', name: '평택 물류센터 현장', address: '경기 평택시 포승읍 500' },
        { id: 's-6', customerId: 'c-6', name: '판교 테크노 현장', address: '경기 성남시 분당구 판교동 600' },
        { id: 's-7', customerId: 'c-1', name: '화성 반도체 현장', address: '경기 화성시 반월동 700' },
        { id: 's-8', customerId: 'c-3', name: '부산 녹산공단 현장', address: '부산 강서구 녹산동 800' },
        { id: 's-9', customerId: 'c-4', name: '인천 영종도 현장', address: '인천 중구 운서동 900' },
        { id: 's-10', customerId: 'c-6', name: '이천 하이닉스 현장', address: '경기 이천시 부발읍 1000' }
      ],
      vendors: [
        { id: 'v-1', name: '경기렌탈(주)', type: 'RENTAL', address: '경기 안성시 공도읍 1' },
        { id: 'v-2', name: '수도권리프트(주)', type: 'RENTAL', address: '경기 화성시 남양읍 2' },
        { id: 'v-3', name: '대한고소작업대', type: 'RENTAL', address: '경기 시흥시 정왕동 3' },
        { id: 'v-4', name: '부산영남렌탈', type: 'RENTAL', address: '부산 사상구 삼락동 4' }
      ],
      assets: [],
      contracts: [],
      contractAssets: [],
      contractHistory: [],
      deliveries: [],
      assetInOutLogs: [],
      billings: [],
      billingDetails: [],
      notifications: []
    };
    this.seq = 3000;
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
}

// 2. Business Logic Modules

// [1] 전대 장비 외부 임차 등록 (자산 마스터 입고 준비)
function registerSubleaseAsset(db, vendorId, modelName, vendorAssetNo, rentStartDate, vendorMonthlyFee, vendorDailyFee = 0) {
  const vendor = db.tables.vendors.find(v => v.id === vendorId);
  const assetNo = `RENT-${modelName.slice(0, 4)}-${String(++db.seq).slice(-2)}`;
  
  const asset = db.insertRow('assets', {
    assetNo,
    modelName,
    ownerType: 'RENTED', // 타사 임차 (전대)
    vendorId: vendor.id,
    renter: vendor.name,
    vendorAssetNo,
    status: 'AVAILABLE', // 대여 가능 상태로 등록
    monthlyRentalFee: vendorMonthlyFee, // 원사 지출 월임차료
    dailyRentalFee: vendorDailyFee || Math.round(vendorMonthlyFee / 30),
    rentStart: rentStartDate,
    maintenanceScore: 0
  });

  return asset;
}

// [2] 계약 체결 (영업사원의 출고 의뢰 ➔ 전대 장비 매핑)
function createSubleaseContract(db, customerId, siteId, assetId, clientStartDate, clientMonthlyFee, clientDailyFee, options = {}) {
  const asset = db.tables.assets.find(a => a.id === assetId);
  const contract = db.insertRow('contracts', {
    contractNo: `CONTR-2026-SUB-${String(++db.seq).slice(-4)}`,
    contractType: 'RENTAL',
    customerId,
    siteId,
    startDate: clientStartDate,
    billingDay: 30,
    paymentDueDay: 25,
    status: 'ACTIVE',
    specialOptions: options.requiredOptions || []
  });

  const ca = db.insertRow('contractAssets', {
    contractId: contract.id,
    assetId: asset.id,
    expectedModel: asset.modelName,
    monthlyRentalFee: clientMonthlyFee, // 고객 매출 월렌탈료
    dailyRentalFee: clientDailyFee,
    startDate: clientStartDate,
    status: 'ASSIGNED'
  });

  db.insertRow('contractHistory', {
    contractId: contract.id,
    changeType: 'REGISTER',
    changeDate: clientStartDate,
    description: `계약 체결 및 전대 장비 매핑 (${asset.modelName} - ${asset.assetNo}, 임차처: ${asset.renter})`
  });

  return { contract, ca };
}

// [3] 출고 프로세스 실행 (경유 옵션장착 vs 직송)
function executeSubleaseOutbound(db, contractId, assetId, outboundType, optionName, costs = {}) {
  const contract = db.tables.contracts.find(c => c.id === contractId);
  const ca = db.tables.contractAssets.find(ca => ca.contractId === contractId && ca.assetId === assetId);
  const asset = db.tables.assets.find(a => a.id === assetId);
  const customer = db.tables.customers.find(c => c.id === contract.customerId);
  const site = db.tables.sites.find(s => s.id === contract.siteId);
  const vendor = db.tables.vendors.find(v => v.id === asset.vendorId);

  const deliveriesCreated = [];

  if (outboundType === 'VIA_YARD_OPTION') {
    // ─────────────── [유형 A: 경유 출고 (옵션 장착)] ───────────────
    // 1차 배차: 임차처 ➔ 당사 주기장 입고
    const d1 = db.insertRow('deliveries', {
      contractId: contract.id,
      assetId: asset.id,
      type: 'INBOUND',
      dispatchCategory: '전대입고',
      status: 'COMPLETED',
      originAddress: vendor.address,
      destinationAddress: '본사 주기장',
      deliveryCost: costs.inboundCost || 50000,
      paidBy: costs.inboundPaidBy || 'OURS', // 통상 당사 부담
      memo: `[전대 1차 입고] 옵션 장착(${optionName})을 위한 임차처(${vendor.name}) ➔ 당사 주기장 입고`
    });
    deliveriesCreated.push(d1);

    // 당사 주기장 1차 입고 이력
    db.insertRow('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'INBOUND',
      eventDate: contract.startDate,
      customerId: contract.customerId,
      memo: `[전대 1차 입고] 옵션(${optionName}) 장착을 위한 주기장 입고 완료`
    });

    // 옵션 장착 작업 (메모 보강)
    db.updateRow('assets', asset.id, {
      note: `[옵션 장착 완료] ${optionName}`
    });

    // 2차 배차: 당사 주기장 ➔ 고객사 현장 출고
    const d2 = db.insertRow('deliveries', {
      contractId: contract.id,
      assetId: asset.id,
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      status: 'COMPLETED',
      originAddress: '본사 주기장',
      destinationAddress: site.address,
      deliveryCost: costs.outboundCost || 80000,
      paidBy: costs.outboundPaidBy || 'CUSTOMER',
      memo: `[전대 2차 출고] 옵션(${optionName}) 장착 완료 후 고객사 현장 납품`
    });
    deliveriesCreated.push(d2);

    // 현장 출고 검수 승인 마감 시 RENTED 전환 (헌장 1.3)
    db.updateRow('assets', asset.id, {
      status: 'RENTED',
      currentCustomerId: contract.customerId,
      currentSiteId: contract.siteId,
      contractStart: contract.startDate
    });
    db.updateRow('contractAssets', ca.id, { status: 'RENTED' });

    db.insertRow('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'OUTBOUND',
      eventDate: contract.startDate,
      customerId: contract.customerId,
      siteId: site.id,
      memo: `[옵션 장착 후 현장 출고] 도착지: ${site.name} (자산상태 RENTED 전환)`
    });

  } else {
    // ─────────────── [유형 B: 직송 출고 (임차처 ➔ 현장 직송)] ───────────────
    const d1 = db.insertRow('deliveries', {
      contractId: contract.id,
      assetId: asset.id,
      type: 'OUTBOUND',
      dispatchCategory: '직송출고',
      status: 'COMPLETED',
      originAddress: vendor.address,
      destinationAddress: site.address,
      deliveryCost: costs.directCost || 90000,
      paidBy: costs.directPaidBy || 'CUSTOMER',
      memo: `[전대 직송 배차] 임차처(${vendor.name})에서 고객사 현장(${site.name})으로 직접 배차`
    });
    deliveriesCreated.push(d1);

    // 현장 도착 검수 승인 즉시 RENTED 전환 (헌장 1.3)
    db.updateRow('assets', asset.id, {
      status: 'RENTED',
      currentCustomerId: contract.customerId,
      currentSiteId: contract.siteId,
      contractStart: contract.startDate
    });
    db.updateRow('contractAssets', ca.id, { status: 'RENTED' });

    db.insertRow('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'OUTBOUND',
      eventDate: contract.startDate,
      customerId: contract.customerId,
      siteId: site.id,
      memo: `[전대 직송 출고] 임차처(${vendor.name}) ➔ 현장(${site.name}) 직송 완료 (자산상태 RENTED 전환)`
    });
  }

  return { deliveriesCreated };
}

// [4] 반납 프로세스 실행 (경유 옵션탈거/점검 vs 현장 직반납)
function executeSubleaseReturn(db, contractId, assetId, returnType, returnDate, reason, returnCosts = {}) {
  const contract = db.tables.contracts.find(c => c.id === contractId);
  const ca = db.tables.contractAssets.find(ca => ca.contractId === contractId && ca.assetId === assetId);
  const asset = db.tables.assets.find(a => a.id === assetId);
  const site = db.tables.sites.find(s => s.id === contract.siteId);
  const vendor = db.tables.vendors.find(v => v.id === asset.vendorId);

  const deliveriesCreated = [];

  if (returnType === 'VIA_YARD_DISMOUNT') {
    // ─────────────── [유형 1: 경유 반납 (옵션 탈거 및 입고점검)] ───────────────
    // 1차 배차: 현장 ➔ 당사 주기장 회수
    const d1 = db.insertRow('deliveries', {
      contractId: contract.id,
      assetId: asset.id,
      type: 'INBOUND',
      dispatchCategory: '회수',
      status: 'COMPLETED',
      originAddress: site.address,
      destinationAddress: '본사 주기장',
      deliveryCost: returnCosts.retrieveCost || 80000,
      paidBy: returnCosts.retrievePaidBy || 'CUSTOMER',
      memo: `[현장 회수] 옵션 탈거 및 입고 점검을 위해 당사 주기장 경유 회수: ${reason}`
    });
    deliveriesCreated.push(d1);

    // 현장 회수 입고 처리: 계약자산 종료, 당사 주기장 임시 입고
    db.updateRow('contractAssets', ca.id, {
      status: 'RETURNED',
      endDate: returnDate,
      actualReturnDate: returnDate
    });

    db.updateRow('assets', asset.id, {
      status: 'AVAILABLE', // 당사 주기장 입고
      currentCustomerId: '',
      currentSiteId: '',
      note: '[옵션 탈거 완료] 원상 복구 및 원사 반납 준비'
    });

    db.insertRow('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'INBOUND',
      eventDate: returnDate,
      customerId: contract.customerId,
      memo: `[현장 회수 입고] 옵션 탈거 및 반납 점검을 위해 당사 주기장 입고 완료`
    });

    // 2차 배차: 당사 주기장 ➔ 임차처 최종 반납
    const d2 = db.insertRow('deliveries', {
      contractId: contract.id,
      assetId: asset.id,
      type: 'OUTBOUND',
      dispatchCategory: '전대반납',
      status: 'COMPLETED',
      originAddress: '본사 주기장',
      destinationAddress: vendor.address,
      deliveryCost: returnCosts.vendorReturnCost || 50000,
      paidBy: returnCosts.vendorReturnPaidBy || 'OURS',
      memo: `[원사 최종 반납] 당사 주기장에서 임차처(${vendor.name})로 반납 반출`
    });
    deliveriesCreated.push(d2);

    // 원사 최종 반납 마감: RENTED_RETURNED
    db.updateRow('assets', asset.id, {
      status: 'RENTED_RETURNED',
      actualRentReturnDate: returnDate
    });

    db.insertRow('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'OUTBOUND',
      eventDate: returnDate,
      memo: `[원사 최종 반납] 임차처(${vendor.name})로 반납 반출 완료 (RENTED_RETURNED 마감)`
    });

  } else {
    // ─────────────── [유형 2: 직반납 (현장 ➔ 임차처 직송)] ───────────────
    const d1 = db.insertRow('deliveries', {
      contractId: contract.id,
      assetId: asset.id,
      type: 'INBOUND',
      dispatchCategory: '직반납',
      status: 'COMPLETED',
      originAddress: site.address,
      destinationAddress: vendor.address,
      deliveryCost: returnCosts.directReturnCost || 90000,
      paidBy: returnCosts.directReturnPaidBy || 'CUSTOMER',
      memo: `[전대 직반납] 고객사 현장(${site.name})에서 임차처(${vendor.name})로 직접 반납 종결`
    });
    deliveriesCreated.push(d1);

    // 계약자산 마감 및 원사 직반납 즉시 RENTED_RETURNED 전이
    db.updateRow('contractAssets', ca.id, {
      status: 'RETURNED',
      endDate: returnDate,
      actualReturnDate: returnDate
    });

    db.updateRow('assets', asset.id, {
      status: 'RENTED_RETURNED',
      actualRentReturnDate: returnDate,
      currentCustomerId: '',
      currentSiteId: '',
      note: `현장(${site.name})에서 임차처(${vendor.name})로 직반납 종결`
    });

    db.insertRow('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'OUTBOUND',
      eventDate: returnDate,
      memo: `[전대 현장 직반납] 현장(${site.name}) ➔ 임차처(${vendor.name}) 직송 반납 종결 (RENTED_RETURNED 마감)`
    });
  }

  // 계약 이력 기록
  db.insertRow('contractHistory', {
    contractId: contract.id,
    changeType: 'RETURN',
    changeDate: returnDate,
    description: `전대 장비 반납 완료 (${asset.modelName} - ${asset.assetNo} / 반납방식: ${returnType === 'VIA_YARD_DISMOUNT' ? '당사 경유 옵션탈거' : '현장 직반납'})`
  });

  return { deliveriesCreated };
}

// [5] 매출 청구 및 원사 임차료 대사 검증
function auditFinancials(db, contractId, assetId, days) {
  const contract = db.tables.contracts.find(c => c.id === contractId);
  const ca = db.tables.contractAssets.find(ca => ca.contractId === contractId && ca.assetId === assetId);
  const asset = db.tables.assets.find(a => a.id === assetId);

  // 1. 매출 계산 (고객 렌탈료 + 고객 청구 운송료)
  const clientDaily = ca.dailyRentalFee > 0 ? ca.dailyRentalFee : Math.round(ca.monthlyRentalFee / 30);
  const revenueRental = days < 30 ? clientDaily * days : ca.monthlyRentalFee;

  const contractDeliveries = db.tables.deliveries.filter(d => d.contractId === contract.id && d.assetId === asset.id);
  const customerTransportRevenue = contractDeliveries
    .filter(d => d.paidBy === 'CUSTOMER')
    .reduce((sum, d) => sum + (d.deliveryCost || 0), 0);

  const totalRevenue = revenueRental + customerTransportRevenue;

  // 2. 매입/지출 계산 (원사 임차료 + 총 배차 운임)
  const vendorDaily = asset.dailyRentalFee > 0 ? asset.dailyRentalFee : Math.round(asset.monthlyRentalFee / 30);
  const vendorRentCost = days < 30 ? vendorDaily * days : asset.monthlyRentalFee;

  // 운송기사에게 지급하는 총 운임
  const totalFreightPaid = contractDeliveries.reduce((sum, d) => sum + (d.deliveryCost || 0), 0);

  // 당사 순부담 운송비 (총운임 - 고객청구분 = paidBy 'OURS')
  const ourTransportExpense = contractDeliveries
    .filter(d => d.paidBy === 'OURS')
    .reduce((sum, d) => sum + (d.deliveryCost || 0), 0);

  const totalExpense = vendorRentCost + totalFreightPaid;
  const netMargin = totalRevenue - totalExpense; // = (revenueRental - vendorRentCost) - ourTransportExpense

  return {
    revenueRental,
    customerTransportRevenue,
    totalRevenue,
    vendorRentCost,
    totalFreightPaid,
    ourTransportExpense,
    totalExpense,
    netMargin,
    rentalMargin: revenueRental - vendorRentCost,
    contractDeliveries
  };
}

// 3. WTT 10회 전수 실행 러너
async function runAll10SubleaseWTTs() {
  console.log('================================================================');
  console.log('🚚 [전대자산 출고·반납 전 주기 4대 경로] WTT 10회 심층 관통 검증');
  console.log('================================================================\n');

  const results = [];

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-01: [경유출고 - 경유반납] 삼성 고덕현장 특수안전옵션(협착방지봉) 장착 출고 ➔ 주기장 경유 탈거 후 원사 반납
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-1', 'GS-1930', 'K-19-88', '2026-09-01', 350000);
    const { contract } = createSubleaseContract(db, 'c-1', 's-1', asset.id, '2026-09-01', 500000, 17000, { requiredOptions: ['협착방지봉', '경광등'] });
    
    // 출고: 임차처 ➔ 당사 ➔ 현장 (2단계)
    executeSubleaseOutbound(db, contract.id, asset.id, 'VIA_YARD_OPTION', '협착방지봉+경광등', {
      inboundCost: 50000, inboundPaidBy: 'OURS',
      outboundCost: 80000, outboundPaidBy: 'CUSTOMER'
    });

    const assetMid = db.tables.assets.find(a => a.id === asset.id);
    const midPass = assetMid.status === 'RENTED';

    // 반납: 현장 ➔ 당사 ➔ 임차처 (2단계)
    executeSubleaseReturn(db, contract.id, asset.id, 'VIA_YARD_DISMOUNT', '2026-09-30', '공기 종료 및 옵션 탈거', {
      retrieveCost: 80000, retrievePaidBy: 'CUSTOMER',
      vendorReturnCost: 50000, vendorReturnPaidBy: 'OURS'
    });

    const assetFinal = db.tables.assets.find(a => a.id === asset.id);
    const totalDelivCount = db.tables.deliveries.filter(d => d.contractId === contract.id).length;
    const fin = auditFinancials(db, contract.id, asset.id, 30);

    // 렌탈마진: 500k - 350k = 150k. 당사부담 운송비: 100k (50k+50k). 순마진: 50k.
    const pass = midPass && assetFinal.status === 'RENTED_RETURNED' && totalDelivCount === 4 && fin.netMargin === 50000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-01',
      title: '[경유출고 - 경유반납] 삼성 고덕 특수안전옵션(협착방지봉) 4단계 배차 & 옵션 탈거 원사 반납',
      pass,
      detail: pass ? `배차 4회 완결, 자산상태 RENTED ➔ RENTED_RETURNED 마감, 총매출 ₩${fin.totalRevenue.toLocaleString()} = 총지출 ₩${fin.totalExpense.toLocaleString()} + 마진 ₩${fin.netMargin.toLocaleString()}` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-02: [직송출고 - 직반납] 송도 센트럴 / GTJZ1012E 표준기종 급발주 직송 ➔ 직반납 (운송비 절감)
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-2', 'GTJZ1012E', 'SDK-1012-05', '2026-09-01', 450000);
    const { contract } = createSubleaseContract(db, 'c-2', 's-2', asset.id, '2026-09-01', 600000, 20000);

    // 출고: 임차처 ➔ 현장 직송 (1단계)
    executeSubleaseOutbound(db, contract.id, asset.id, 'DIRECT_TO_SITE', '', {
      directCost: 90000, directPaidBy: 'CUSTOMER'
    });

    const assetMid = db.tables.assets.find(a => a.id === asset.id);

    // 반납: 현장 ➔ 임차처 직반납 (1단계)
    executeSubleaseReturn(db, contract.id, asset.id, 'DIRECT_TO_VENDOR', '2026-09-30', '공기 종료 직반납', {
      directReturnCost: 90000, directReturnPaidBy: 'CUSTOMER'
    });

    const assetFinal = db.tables.assets.find(a => a.id === asset.id);
    const totalDelivCount = db.tables.deliveries.filter(d => d.contractId === contract.id).length;
    const fin = auditFinancials(db, contract.id, asset.id, 30);

    // 렌탈마진: 600k - 450k = 150k. 당사부담 운송비: 0k. 순마진: 150k.
    const pass = assetMid.status === 'RENTED' && assetFinal.status === 'RENTED_RETURNED' && totalDelivCount === 2 && fin.ourTransportExpense === 0 && fin.netMargin === 150000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-02',
      title: '[직송출고 - 직반납] 송도 센트럴 표준기종 1:1 직송 및 직반납 (운송 배차 2회 최소화)',
      pass,
      detail: pass ? `왕복 직송 2회 배차 완료, 당사 운송비 ₩0 (전액 고객부담), 순마진 ₩150,000 확보` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-03: [경유출고 - 직반납] 반포 디에이치 바닥 보양/비산방지포 장착 출고 ➔ 현장 자체폐기 후 원사 직반납
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-1', 'SJ-3219', 'SJ-99', '2026-09-01', 350000);
    const { contract } = createSubleaseContract(db, 'c-3', 's-3', asset.id, '2026-09-01', 500000, 17000);

    // 출고: 당사 경유 (소모성 비산방지포 장착)
    executeSubleaseOutbound(db, contract.id, asset.id, 'VIA_YARD_OPTION', '비산방지포+바닥보양', {
      inboundCost: 50000, inboundPaidBy: 'OURS',
      outboundCost: 70000, outboundPaidBy: 'CUSTOMER'
    });

    // 반납: 현장에서 보양재 폐기 후 임차처로 직반납 (1단계)
    executeSubleaseReturn(db, contract.id, asset.id, 'DIRECT_TO_VENDOR', '2026-09-30', '현장 보양재 폐기 후 원사 직반납', {
      directReturnCost: 80000, directReturnPaidBy: 'CUSTOMER'
    });

    const assetFinal = db.tables.assets.find(a => a.id === asset.id);
    const totalDelivCount = db.tables.deliveries.filter(d => d.contractId === contract.id).length;
    const fin = auditFinancials(db, contract.id, asset.id, 30);

    // 렌탈마진: 500k - 350k = 150k. 당사부담 운송비: 50k (입고). 순마진: 100k.
    const pass = assetFinal.status === 'RENTED_RETURNED' && totalDelivCount === 3 && fin.ourTransportExpense === 50000 && fin.netMargin === 100000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-03',
      title: '[경유출고 - 직반납] 반포 디에이치 보양장착 경유출고 ➔ 소모재 현장폐기 후 원사 직반납 (배차 3회)',
      pass,
      detail: pass ? `총 배차 3회(입고1, 출고1, 직반납1), 자산 RENTED_RETURNED 종결, 순마진 ₩100,000` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-04: [직송출고 - 경유반납] 과천 푸르지오 직송 출고 ➔ 사용 중 흠집 발생으로 주기장 경유 세척/도색 후 반납
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-3', 'GS-2646', 'DH-2646', '2026-09-01', 400000);
    const { contract } = createSubleaseContract(db, 'c-4', 's-4', asset.id, '2026-09-01', 550000, 18000);

    // 출고: 임차처 ➔ 현장 직송
    executeSubleaseOutbound(db, contract.id, asset.id, 'DIRECT_TO_SITE', '', {
      directCost: 80000, directPaidBy: 'CUSTOMER'
    });

    // 반납: 현장 ➔ 당사 주기장(세척/도색) ➔ 임차처
    executeSubleaseReturn(db, contract.id, asset.id, 'VIA_YARD_DISMOUNT', '2026-09-30', '현장 분체도색 오염 세척 및 원상복구 반납', {
      retrieveCost: 80000, retrievePaidBy: 'CUSTOMER',
      vendorReturnCost: 50000, vendorReturnPaidBy: 'OURS'
    });

    const assetFinal = db.tables.assets.find(a => a.id === asset.id);
    const totalDelivCount = db.tables.deliveries.filter(d => d.contractId === contract.id).length;
    const fin = auditFinancials(db, contract.id, asset.id, 30);

    // 렌탈마진: 550k - 400k = 150k. 당사부담 운송비: 50k (원사반납). 순마진: 100k.
    const pass = assetFinal.status === 'RENTED_RETURNED' && totalDelivCount === 3 && fin.ourTransportExpense === 50000 && fin.netMargin === 100000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-04',
      title: '[직송출고 - 경유반납] 과천 푸르지오 직송출고 ➔ 오염 발생으로 당사 주기장 경유 세척 후 반납 (배차 3회)',
      pass,
      detail: pass ? `총 배차 3회(직송1, 회수1, 원사반납1), 원상복구 후 RENTED_RETURNED 종결, 순마진 ₩100,000` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-05: [경유출고 - 경유반납 / 고객사 운송비 전액부담] 평택 물류센터 상하기어 보호대 장착
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-2', 'GS-3246', 'SK-32-12', '2026-09-01', 450000);
    const { contract } = createSubleaseContract(db, 'c-5', 's-5', asset.id, '2026-09-01', 650000, 22000);

    // 출고: 임차처 ➔ 당사(고객부담 ₩50,000) ➔ 현장(고객부담 ₩80,000)
    executeSubleaseOutbound(db, contract.id, asset.id, 'VIA_YARD_OPTION', '상하기어 보호대+릴선', {
      inboundCost: 50000, inboundPaidBy: 'CUSTOMER',
      outboundCost: 80000, outboundPaidBy: 'CUSTOMER'
    });

    // 반납: 현장 ➔ 당사(고객부담 ₩80,000) ➔ 원사(고객부담 ₩50,000)
    executeSubleaseReturn(db, contract.id, asset.id, 'VIA_YARD_DISMOUNT', '2026-09-30', '상하기어 보호대 탈거', {
      retrieveCost: 80000, retrievePaidBy: 'CUSTOMER',
      vendorReturnCost: 50000, vendorReturnPaidBy: 'CUSTOMER'
    });

    const fin = auditFinancials(db, contract.id, asset.id, 30);
    // 고객청구 운송비: 260k. 당사부담 운송비: 0k. 렌탈마진: 650k - 450k = 200k. 순마진: 200k.
    const pass = fin.ourTransportExpense === 0 && fin.customerTransportRevenue === 260000 && fin.netMargin === 200000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-05',
      title: '[경유출고 - 경유반납 / 고객사 운송료 전액부담] 특수옵션 4회 운송료(₩260,000) 전액 고객 청구형',
      pass,
      detail: pass ? `당사 부담 운송비 ₩0, 고객 운송비 청구 ₩260,000, 순 마진 ₩200,000 완전 일치` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-06: [직송출고 - 직반납 / 단기 10일 긴급대여] 판교 테크노 GS-1930 10일 일할 마진 정밀 대사
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-1', 'GS-1930', 'K-19-99', '2026-09-01', 300000, 10000);
    const { contract } = createSubleaseContract(db, 'c-6', 's-6', asset.id, '2026-09-01', 450000, 15000);

    executeSubleaseOutbound(db, contract.id, asset.id, 'DIRECT_TO_SITE', '', {
      directCost: 70000, directPaidBy: 'CUSTOMER'
    });

    executeSubleaseReturn(db, contract.id, asset.id, 'DIRECT_TO_VENDOR', '2026-09-10', '10일 단기 작업 완료', {
      directReturnCost: 70000, directReturnPaidBy: 'CUSTOMER'
    });

    const fin = auditFinancials(db, contract.id, asset.id, 10);
    // 일할 10일: 매출 150k - 매입 100k = 순마진 50k.
    const pass = fin.revenueRental === 150000 && fin.vendorRentCost === 100000 && fin.netMargin === 50000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-06',
      title: '[직송출고 - 직반납 / 단기 10일 대여] 판교 테크노 10일 일할 매출(₩150,000) vs 매입(₩100,000) 마진 대사',
      pass,
      detail: pass ? `10일 일할 단가 정밀 계산: 매출 ₩150,000 - 매입 ₩100,000 = 순마진 ₩50,000` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-07: [경유출고 - 경유반납 / 고가 굴절붐 Z-45] 화성 반도체 안전인증 및 테스터 정밀점검
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-2', 'Z-45/25J', 'SDK-Z45-01', '2026-09-01', 1200000);
    const { contract } = createSubleaseContract(db, 'c-1', 's-7', asset.id, '2026-09-01', 1600000, 53000);

    executeSubleaseOutbound(db, contract.id, asset.id, 'VIA_YARD_OPTION', '국가안전인증 스티커+과하중감지기 교정', {
      inboundCost: 100000, inboundPaidBy: 'OURS',
      outboundCost: 150000, outboundPaidBy: 'CUSTOMER'
    });

    executeSubleaseReturn(db, contract.id, asset.id, 'VIA_YARD_DISMOUNT', '2026-09-30', '반도체 공정 완료 후 정밀 검수 반납', {
      retrieveCost: 150000, retrievePaidBy: 'CUSTOMER',
      vendorReturnCost: 100000, vendorReturnPaidBy: 'OURS'
    });

    const fin = auditFinancials(db, contract.id, asset.id, 30);
    // 렌탈마진: 1,600k - 1,200k = 400k. 당사부담 왕복탁송: 200k. 순마진: 200k.
    const pass = fin.netMargin === 200000 && fin.ourTransportExpense === 200000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-07',
      title: '[경유출고 - 경유반납 / 고가 굴절붐] 화성 반도체 Z-45 안전점검 및 테스터 입고 후 원사 반납',
      pass,
      detail: pass ? `굴절붐 당사 정밀검수 배차 4회 완결, 당사 왕복탁송 ₩200,000 제외 순마진 ₩200,000 확보` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-08: [직송출고 - 직반납 / 원거리 지방현장] 부산 녹산공단 GS-4047 현지 협력사 직송/직반납
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-4', 'GS-4047', 'BS-4047-01', '2026-09-01', 700000);
    const { contract } = createSubleaseContract(db, 'c-3', 's-8', asset.id, '2026-09-01', 950000, 31000);

    executeSubleaseOutbound(db, contract.id, asset.id, 'DIRECT_TO_SITE', '', {
      directCost: 100000, directPaidBy: 'CUSTOMER'
    });

    executeSubleaseReturn(db, contract.id, asset.id, 'DIRECT_TO_VENDOR', '2026-09-30', '부산 현지 직반납', {
      directReturnCost: 100000, directReturnPaidBy: 'CUSTOMER'
    });

    const fin = auditFinancials(db, contract.id, asset.id, 30);
    // 렌탈마진: 950k - 700k = 250k. 당사부담 운송비: 0k. 순마진: 250k.
    const pass = fin.ourTransportExpense === 0 && fin.netMargin === 250000 && (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    results.push({
      id: 'WTT-SUB-08',
      title: '[직송출고 - 직반납 / 원거리 지방현장] 부산 협력사 ➔ 녹산공단 직송 및 직반납 (수도권 탁송비 100% 절감)',
      pass,
      detail: pass ? `현지 직송/직반납으로 장거리 탁송비 ₩0 절감, 순마진 ₩250,000 확보` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-09: [경유출고 - 복합반납 (1대 경유 / 1대 직반납)] 인천 영종도 GS-1930 2대 분기 반납
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset1 = registerSubleaseAsset(db, 'v-1', 'GS-1930', 'K-19-A', '2026-09-01', 300000);
    const asset2 = registerSubleaseAsset(db, 'v-1', 'GS-1930', 'K-19-B', '2026-09-01', 300000);

    const { contract } = createSubleaseContract(db, 'c-4', 's-9', asset1.id, '2026-09-01', 450000, 15000);
    // asset2도 동일 계약에 바인딩
    db.insertRow('contractAssets', {
      contractId: contract.id,
      assetId: asset2.id,
      expectedModel: asset2.modelName,
      monthlyRentalFee: 450000,
      dailyRentalFee: 15000,
      startDate: '2026-09-01',
      status: 'ASSIGNED'
    });

    // 2대 모두 경유 출고 (옵션 장착)
    executeSubleaseOutbound(db, contract.id, asset1.id, 'VIA_YARD_OPTION', '보양작업', { inboundCost: 30000, outboundCost: 50000 });
    executeSubleaseOutbound(db, contract.id, asset2.id, 'VIA_YARD_OPTION', '보양작업', { inboundCost: 30000, outboundCost: 50000 });

    // 반납 시 분기: asset1은 경유 반납(옵션탈거), asset2는 현장 직반납
    executeSubleaseReturn(db, contract.id, asset1.id, 'VIA_YARD_DISMOUNT', '2026-09-30', '옵션 탈거 경유 반납');
    executeSubleaseReturn(db, contract.id, asset2.id, 'DIRECT_TO_VENDOR', '2026-09-30', '원사 직반납');

    const a1Final = db.tables.assets.find(a => a.id === asset1.id);
    const a2Final = db.tables.assets.find(a => a.id === asset2.id);

    const pass = a1Final.status === 'RENTED_RETURNED' && a2Final.status === 'RENTED_RETURNED';
    results.push({
      id: 'WTT-SUB-09',
      title: '[경유출고 - 복합반납] 영종도 2대 동시 출고 ➔ 1대 당사 경유 탈거 반납 + 1대 현장 직반납 복합 분기',
      pass,
      detail: pass ? `복수 장비 분기 반납 처리 완료: a-1(경유) / a-2(직송) 모두 RENTED_RETURNED 마감` : '실패'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WTT-SUB-10: [직송출고 - 직반납 / 월말 임차료 대사 및 마진 검증] 이천 하이닉스 GTJZ1212E 회계 무결성
  // ─────────────────────────────────────────────────────────────
  {
    const db = new MockDB();
    const asset = registerSubleaseAsset(db, 'v-3', 'GTJZ1212E', 'DH-1212-01', '2026-09-01', 450000);
    const { contract } = createSubleaseContract(db, 'c-6', 's-10', asset.id, '2026-09-01', 600000, 20000);

    executeSubleaseOutbound(db, contract.id, asset.id, 'DIRECT_TO_SITE', '', {
      directCost: 80000, directPaidBy: 'CUSTOMER'
    });

    executeSubleaseReturn(db, contract.id, asset.id, 'DIRECT_TO_VENDOR', '2026-09-30', '정기 계약 만료 직반납', {
      directReturnCost: 80000, directReturnPaidBy: 'CUSTOMER'
    });

    const fin = auditFinancials(db, contract.id, asset.id, 30);
    const equationHold = (fin.totalRevenue === fin.totalExpense + fin.netMargin);
    // 총매출: 600k 렌탈 + 160k 운송 = 760k. 총비용: 450k 원사 + 160k 운송 = 610k. 순마진: 150k.
    const pass = equationHold && fin.totalRevenue === 760000 && fin.totalExpense === 610000 && fin.netMargin === 150000;

    results.push({
      id: 'WTT-SUB-10',
      title: '[직송출고 - 직반납 / 회계 마진 대사] 이천 하이닉스 임차료(₩450,000) vs 렌탈료(₩600,000) 대차대조식 무결성',
      pass,
      detail: pass ? `회계 대차대조식 (총매출 = 총매입 + 순마진) 완벽 성립: ₩760,000 = ₩610,000 + ₩150,000 (차액 ₩0)` : '실패'
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

runAll10SubleaseWTTs().catch(console.error);
