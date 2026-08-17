// src/services/pdfBundle.ts
// (주)기연리프트 통합 출고/계약 서류 팩 PDF (단일 PDF 파일) 생성 및 병합 서비스
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface SampleContractBundleOptions {
  customerName?: string;
  contractDate?: string;
  contractStartDate?: string;
  contractEndDate?: string; // 미정이거나 null이면 장기계약으로 간주
  siteName?: string;
  siteAddress?: string;
  contractNo?: string;
  currentInsuranceStartDate?: string;
  currentInsuranceEndDate?: string;
  nextInsuranceStartDate?: string;
  nextInsuranceEndDate?: string;
  assets?: Array<{
    assetNo: string;
    modelName: string;
    sn: string;
    rentalFee: number;
  }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML 템플릿 생성기 (계약 기간 대 보험 유효기간 자동 검증 및 다중 연동)
// ──────────────────────────────────────────────────────────────────────────────
function generateBundleHTML(opts?: SampleContractBundleOptions): string[] {
  const cName = opts?.customerName || '주식회사 세보엠이씨';
  const cDate = opts?.contractDate || '2026년 8월 12일';
  const sName = opts?.siteName || '용인 SK하이닉스(팹동)';
  const sAddr = opts?.siteAddress || '경기도 용인시 처인구 원삼면 백원로 46번길 33';
  
  const cEndDate = opts?.contractEndDate; // 예: '2027-08-30' 또는 undefined
  const currentInsEnd = opts?.currentInsuranceEndDate || '2027-03-05';
  const currentInsStart = opts?.currentInsuranceStartDate || '2026-03-05';
  
  const nextInsStart = opts?.nextInsuranceStartDate || '2027-03-05';
  const nextInsEnd = opts?.nextInsuranceEndDate || '2028-03-05';

  // 💡 [보험 유효기간 자동 검증] 계약 만료일이 현재 보험 만료일을 초과하거나 '종료일 미정(장기계약)'인 경우 차기 보험증서 자동 연속 첨부
  const needsRenewalInsurance = !cEndDate || (cEndDate > currentInsEnd);

  const assetList = opts?.assets || [
    { assetNo: 'G06119', modelName: 'GTJZ0608ME', sn: '0108000379', rentalFee: 390000 },
    { assetNo: 'G06120', modelName: 'GTJZ0608ME', sn: '0108000357', rentalFee: 390000 },
    { assetNo: 'G06121', modelName: 'GTJZ0608ME', sn: '0108000426', rentalFee: 390000 },
  ];

  const pages: string[] = [];

  const commonStyle = `
    font-family: 'Noto Sans KR', sans-serif;
    color: #111;
    background: #fff;
    width: 700px;
    height: 990px;
    padding: 24px;
    box-sizing: border-box;
    position: relative;
  `;

  // 📄 Page 1: 고소작업대 임대차 계약서
  pages.push(`
    <div style="${commonStyle}">
      <h1 style="text-align:center; font-size:24px; font-weight:800; margin-bottom:4px; letter-spacing:4px;">고소작업대 임대차 계약서</h1>
      <p style="text-align:center; font-size:13px; font-weight:bold; margin-bottom:16px;">${cDate}</p>

      <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:12px; margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; width:12%; background:#f5f5f5;">임대인 (갑)</td>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; width:12%;">등록번호</td>
          <td style="border:1px solid #000; padding:6px; text-align:center; width:26%;">138-81-83251</td>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; width:12%; background:#f5f5f5;">임차인 (을)</td>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; width:12%;">등록번호</td>
          <td style="border:1px solid #000; padding:6px; text-align:center; width:26%;">118-81-00241</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; background:#f5f5f5;">상 호</td>
          <td colSpan="2" style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center;">주식회사 기연리프트</td>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; background:#f5f5f5;">상 호</td>
          <td colSpan="2" style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center;">${cName}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; background:#f5f5f5;">대 표 자</td>
          <td colSpan="2" style="border:1px solid #000; padding:6px; text-align:center;">이 수 용 (인)</td>
          <td style="border:1px solid #000; padding:6px; font-weight:bold; text-align:center; background:#f5f5f5;">대 표 자</td>
          <td colSpan="2" style="border:1px solid #000; padding:6px; text-align:center;">김우영, 이원하</td>
        </tr>
      </table>

      <h3 style="font-size:14px; font-weight:bold; text-align:center; margin:12px 0 6px;">임대차 계약 내용</h3>

      <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:11px; margin-bottom:12px;">
        <tr>
          <td style="border:1px solid #000; padding:5px; font-weight:bold; background:#f5f5f5; width:15%;">장비 인도장소</td>
          <td style="border:1px solid #000; padding:5px;">${sName}</td>
          <td style="border:1px solid #000; padding:5px; font-weight:bold; background:#f5f5f5; width:15%;">장비 인도 예정일</td>
          <td style="border:1px solid #000; padding:5px;">2026년 8월 15일 토요일</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:5px; font-weight:bold; background:#f5f5f5;">현장 상세 위치</td>
          <td colSpan="3" style="border:1px solid #000; padding:5px;">${sAddr}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:11px; text-align:center; margin-bottom:12px;">
        <thead>
          <tr style="background:#f5f5f5; font-weight:bold;">
            <th style="border:1px solid #000; padding:6px;">품목(모델명)</th>
            <th style="border:1px solid #000; padding:6px;">수량</th>
            <th style="border:1px solid #000; padding:6px;">장비 번호(S/N)</th>
            <th style="border:1px solid #000; padding:6px;">임대료 (1대/1개월)</th>
            <th style="border:1px solid #000; padding:6px;">소계</th>
            <th style="border:1px solid #000; padding:6px;">운송료</th>
            <th style="border:1px solid #000; padding:6px;">합계</th>
            <th style="border:1px solid #000; padding:6px;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${assetList.map(a => `
            <tr>
              <td style="border:1px solid #000; padding:6px;">${a.modelName}</td>
              <td style="border:1px solid #000; padding:6px;">1</td>
              <td style="border:1px solid #000; padding:6px;">${a.assetNo}<br/><span style="font-size:9px; color:#555;">(${a.sn})</span></td>
              <td style="border:1px solid #000; padding:6px; text-align:right;">${a.rentalFee.toLocaleString()}</td>
              <td style="border:1px solid #000; padding:6px; text-align:right;">${a.rentalFee.toLocaleString()}</td>
              <td rowSpan="5" style="border:1px solid #000; padding:6px; font-size:10px; font-weight:bold;">[운송료 청구기준 참조]</td>
              <td rowSpan="5" style="border:1px solid #000; padding:6px; font-weight:bold; font-size:13px; text-align:right;">₩1,680,000</td>
              <td rowSpan="5" style="border:1px solid #000; padding:6px; font-size:10px;">부가세 별도<br/>/<br/>운송료 별도</td>
            </tr>
          `).join('')}
          <tr>
            <td style="border:1px solid #000; padding:6px;">옵션(협착난간대)</td>
            <td style="border:1px solid #000; padding:6px;">3</td>
            <td style="border:1px solid #000; padding:6px;">일회성청구</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">100,000</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">300,000</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:6px;">옵션(튜브소화기)</td>
            <td style="border:1px solid #000; padding:6px;">3</td>
            <td style="border:1px solid #000; padding:6px;">일회성청구</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">70,000</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">210,000</td>
          </tr>
        </tbody>
      </table>

      <div style="border:1px solid #000; padding:8px; font-size:10.5px; line-height:1.5; margin-bottom:12px;">
        <strong>운송료 청구 기준:</strong> ■ 2개월 이하: 왕복 운반비 임차인 부담 &nbsp;■ 4개월 이하: 편도 운반비 임차인 부담 &nbsp;■ 4개월 초과: 왕복 운반비 임대인 부담<br/>
        <strong>첨부서류:</strong> 계약서, 작동법, 반입전체크리스트, 안전점검결과서, 안전인증서, PL보험증권${needsRenewalInsurance ? '(당해+차기 연속첨부)' : ''}, 사업자등록증, 통장사본
      </div>

      <div style="border:1px solid #000; padding:8px; font-size:10px; line-height:1.4; background:#fafafa;">
        <strong>건설기계 사용시 주의사항:</strong><br/>
        1. 지게차 및 크레인을 이용한 장비 상·하차비용은 임차인이 전액 부담합니다.<br/>
        2. 계약기간 만료 후 반납통보가 없을 시에는 자동으로 임대계약이 연장되며, 반납 시 임차인은 장비를 운반차량에 실어 주셔야 합니다.<br/>
        3. 그 외 기타 사항은 건설기계임대차 표준계약서(공정거래위원회 표준약관 제10059호)의 일반 조건에 따릅니다.<br/>
        <strong>결제 계좌:</strong> 신한은행 140-010-007060 예금주: 주식회사 기연리프트
      </div>
    </div>
  `);

  // 📄 Page 2~4: 반입 전 CHECK LIST (장비 S/N별 3장)
  assetList.forEach((ast) => {
    pages.push(`
      <div style="${commonStyle}">
        <h2 style="text-align:center; font-size:16px; font-weight:bold; margin-bottom:12px; border-bottom:2px solid #000; padding-bottom:6px;">
          ( 모델명: ${ast.modelName} ) ■ 반입 전 CHECK LIST ( 관리번호: ${ast.assetNo} )
        </h2>
        
        <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:9.5px; text-align:center;">
          <thead>
            <tr style="background:#f0f0f0; font-weight:bold;">
              <th style="border:1px solid #000; padding:3px; width:5%;">NO</th>
              <th style="border:1px solid #000; padding:3px; width:35%;">내 용</th>
              <th style="border:1px solid #000; padding:3px; width:15%;">검사기준</th>
              <th style="border:1px solid #000; padding:3px; width:8%;">양호</th>
              <th style="border:1px solid #000; padding:3px; width:5%;">NO</th>
              <th style="border:1px solid #000; padding:3px; width:35%;">내 용</th>
              <th style="border:1px solid #000; padding:3px; width:15%;">검사기준</th>
              <th style="border:1px solid #000; padding:3px; width:8%;">양호</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #000; padding:2px;">1</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">장비외관상태</td><td style="border:1px solid #000;">육안</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">36</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">배터리,장비 연결잭</td><td style="border:1px solid #000;">육안</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">2</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">스위치류 작동,외관상태</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">37</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">배터리 터미널 조임</td><td style="border:1px solid #000;">육안</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">3</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">주행전.후진</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">38</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">배터리비중/부하시험(v)</td><td style="border:1px solid #000;">5.25V이상</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">4</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">리프트업 주행(주행차단)</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">39</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">배터리증류수극판위10MM</td><td style="border:1px solid #000;">10mm이상</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">5</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">고속.저속 주행</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">40</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">하부리프트작동</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">6</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">조향 좌.우회전</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">41</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">경광등</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">7</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">리프트업.다운</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">42</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">노면접지</td><td style="border:1px solid #000;">육안</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">8</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">도장/세차상태</td><td style="border:1px solid #000;">육안</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">43</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">바퀴조임상태</td><td style="border:1px solid #000;">육안</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">9</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">유압 오일양 및 누유</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">44</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">안전고리/풋스위치</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
            <tr><td style="border:1px solid #000; padding:2px;">10</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">과상승방지봉 및 알람</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td><td style="border:1px solid #000; padding:2px;">45</td><td style="border:1px solid #000; text-align:left; padding-left:4px;">낙하물방지턱(현장기준)</td><td style="border:1px solid #000;">작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">○</td></tr>
          </tbody>
        </table>
        
        <p style="font-size:10px; margin-top:14px; color:#555;">
          ※ 주의 : 1. 기준은 출고시에 점검 체크 기준이며 배터리 충전 상태에 따라 성능이 달라질 수 있습니다.<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. 점검자 : <strong>김관주 책임정비기사 (서명)</strong>
        </p>
      </div>
    `);
  });

  // 📄 Page 5~7: 고소작업대(T/L) 안전점검 결과서 (장비 S/N별 3장)
  assetList.forEach((ast) => {
    pages.push(`
      <div style="${commonStyle}">
        <h2 style="text-align:center; font-size:18px; font-weight:bold; margin-bottom:14px; border:2px solid #000; padding:8px; background:#f8f9fa;">
          고소작업대(T/L) 안전점검 결과서
        </h2>
        <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:11px; margin-bottom:14px;">
          <tr>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold; width:15%;">사용업체</td>
            <td style="border:1px solid #000; padding:5px;">${cName}</td>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold; width:15%;">제 조 사</td>
            <td style="border:1px solid #000; padding:5px;">SINOBOOM / (주)기연리프트</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold;">장비중량</td>
            <td style="border:1px solid #000; padding:5px;">1,575 kg</td>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold;">모델명</td>
            <td style="border:1px solid #000; padding:5px;">${ast.modelName}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold;">관리번호</td>
            <td style="border:1px solid #000; padding:5px; font-weight:bold; color:blue;">${ast.assetNo}</td>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold;">안전인증일</td>
            <td style="border:1px solid #000; padding:5px;">2023-06-20</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold;">점검일시</td>
            <td style="border:1px solid #000; padding:5px;">2026-08-15</td>
            <td style="border:1px solid #000; padding:5px; background:#f0f0f0; font-weight:bold;">점검자</td>
            <td style="border:1px solid #000; padding:5px;">김관주 (인)</td>
          </tr>
        </table>

        <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:10px; text-align:center;">
          <thead>
            <tr style="background:#e9ecef; font-weight:bold;">
              <th style="border:1px solid #000; padding:6px; width:20%;">검사부분</th>
              <th style="border:1px solid #000; padding:6px; width:65%;">검사항목</th>
              <th style="border:1px solid #000; padding:6px; width:15%;">검사결과</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #000; padding:6px;">1. 공통사항</td><td style="border:1px solid #000; text-align:left; padding:6px;">제조일로부터 15년 이내 장비 / 비파괴검사 성적서 비치 / 운전원 교육 이수</td><td style="border:1px solid #000; font-weight:bold; color:blue;">양호 (○)</td></tr>
            <tr><td style="border:1px solid #000; padding:6px;">2. 차대 및 타이어</td><td style="border:1px solid #000; text-align:left; padding:6px;">차체 균열/변형 없음 / 타이어 이상마모 없음 / 림볼트 체결 양호</td><td style="border:1px solid #000; font-weight:bold; color:blue;">양호 (○)</td></tr>
            <tr><td style="border:1px solid #000; padding:6px;">3. 연장구조물</td><td style="border:1px solid #000; text-align:left; padding:6px;">구조물 균열/손상 없음 / 힌지부 연결핀 양호 / 잠금밸브 정상작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">양호 (○)</td></tr>
            <tr><td style="border:1px solid #000; padding:6px;">4. 작업대</td><td style="border:1px solid #000; text-align:left; padding:6px;">난간높이 1.0m 이상 / 발끝막이판 0.15m 이상 / 미끄럼 방지 구조</td><td style="border:1px solid #000; font-weight:bold; color:blue;">양호 (○)</td></tr>
            <tr><td style="border:1px solid #000; padding:6px;">5. 제어장치</td><td style="border:1px solid #000; text-align:left; padding:6px;">자동 중립 복귀 / 인에이블 스위치 정상 작동</td><td style="border:1px solid #000; font-weight:bold; color:blue;">양호 (○)</td></tr>
            <tr><td style="border:1px solid #000; padding:6px;">6. 안전장치</td><td style="border:1px solid #000; text-align:left; padding:6px;">과상승 방지봉 / 비상정지 스위치 / 경사 감지 알람 / 비상하강장치 정상</td><td style="border:1px solid #000; font-weight:bold; color:blue;">양호 (○)</td></tr>
          </tbody>
        </table>
      </div>
    `);
  });

  // 📄 Page 8: 작업대 확장 전/후 적재중량 & 장비 제원표
  pages.push(`
    <div style="${commonStyle}">
      <h2 style="text-align:center; font-size:18px; font-weight:bold; margin-bottom:16px;">작업대 확장 전 / 후 적재중량 & 장비 제원표</h2>
      <div style="text-align:center; margin-bottom:20px; padding:16px; border:1px dashed #666; background:#fafafa;">
        <p style="font-size:14px; font-weight:bold; color:#d32f2f; margin-bottom:8px;">[ 최대풍속 : 12.5 m/s 이내 ]</p>
        <p style="font-size:13px;">확장 전 정격하중: <strong>230 kg</strong> &nbsp;|&nbsp; 확장 후 보조작업대: <strong>110 kg</strong></p>
      </div>

      <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:12px; margin-top:20px;">
        <tr style="background:#f0f0f0;">
          <td colSpan="4" style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold; font-size:14px;">장 비 제 원 표 (GTJZ0608ME)</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa; width:20%;">사용업체명</td>
          <td style="border:1px solid #000; padding:8px;">${cName}</td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa; width:20%;">임대업체명</td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold;">(주) 기연리프트</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">장 비 명</td>
          <td style="border:1px solid #000; padding:8px;">GTJZ0608ME</td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">동 력</td>
          <td style="border:1px solid #000; padding:8px;">배터리 충전식</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">작업 높이</td>
          <td style="border:1px solid #000; padding:8px;">7.8 M</td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">발판 높이</td>
          <td style="border:1px solid #000; padding:8px;">5.8 M</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">장비 중량</td>
          <td style="border:1px solid #000; padding:8px;">1,575 Kg</td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">적재 중량</td>
          <td style="border:1px solid #000; padding:8px;">230 Kg</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">장비 크기</td>
          <td style="border:1px solid #000; padding:8px;">1.80 x 0.81 x 2.04 M</td>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">등판 능력</td>
          <td style="border:1px solid #000; padding:8px;">25 %</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:8px; font-weight:bold; background:#fafafa;">A/S 접수</td>
          <td colSpan="3" style="border:1px solid #000; padding:8px; font-weight:bold; color:#1976d2;">031-334-5296 (영업담당자: 010-9402-5296)</td>
        </tr>
      </table>
    </div>
  `);

  // 📄 Page 9: KCs 안전인증서
  pages.push(`
    <div style="${commonStyle}">
      <div style="border:3px double #000; padding:24px; height:90%; box-sizing:border-box; text-align:center;">
        <p style="font-size:12px; text-align:left; margin-bottom:20px;">제2023 - BA2300896002호</p>
        <h1 style="font-size:28px; font-weight:bold; letter-spacing:12px; margin:30px 0 40px;">안 전 인 증 서</h1>
        <div style="text-align:left; font-size:12px; line-height:2.0; margin-bottom:40px;">
          <p><strong>( 사업장명 )</strong> Hunan Sinoboom Intelligent Equipment Co., Ltd.</p>
          <p><strong>( 소 재 지 )</strong> No.128, East Jinzhou Avenue, Ningxiang High-tech Park Changsha, China</p>
        </div>
        <p style="font-size:13px; text-align:left; line-height:1.8; margin-bottom:40px;">
          위 사업장에서 제조하는 아래의 품목이 「산업안전보건법」 제84조 및 같은 법 시행규칙 제110조의제1항에 따른 안전인증 심사 결과 안전·보건기준에 적합하므로 안전인증표시의 사용을 인증합니다.
        </p>
        <div style="border:1px solid #000; padding:16px; margin-bottom:40px; font-size:13px; font-weight:bold;">
          품 목 : 고소작업대 자주식<br/>
          형식·모델 : GTJZ0608ME (0.23Ton) / 23-BA4AH-50005
        </div>
        <p style="font-size:15px; font-weight:bold; margin-top:60px;">2023년 06월 20일</p>
        <h2 style="font-size:22px; font-weight:bold; margin-top:40px;">대 한 산 업 안 전 협 회 장 (인)</h2>
      </div>
    </div>
  `);

  // 📄 Page 10: 장비작동법 가이드
  pages.push(`
    <div style="${commonStyle}">
      <h2 style="text-align:center; font-size:20px; font-weight:bold; background:#d32f2f; color:#fff; padding:10px; margin-bottom:16px;">
        고소작업대 장비 작동법 가이드
      </h2>
      <div style="border:2px solid #d32f2f; padding:10px; margin-bottom:16px; font-size:12px; font-weight:bold; text-align:center; background:#ffebee;">
        작동 전 안전점검 사항 : ❶ 과상승 방지봉 작동 &nbsp; ❷ 비상스위치 작동 &nbsp; ❸ 안전벨트 고정 &nbsp; ❹ 안전모 착용
      </div>

      <div style="display:flex; gap:16px; margin-bottom:16px;">
        <div style="flex:1; border:1px solid #000; padding:12px; font-size:11px; line-height:1.6;">
          <h4 style="font-size:13px; font-weight:bold; background:#e0e0e0; padding:4px; margin-top:0;">■ 하부 작동 순서</h4>
          1. 하부 비상스위치를 당김.<br/>
          2. 키를 (파란색) 좌측으로 돌림.<br/>
          3. 왼손으로 원형버튼을 누른 상태에서 오른손으로 상승/하강 조작.
        </div>
        <div style="flex:1; border:1px solid #000; padding:12px; font-size:11px; line-height:1.6;">
          <h4 style="font-size:13px; font-weight:bold; background:#e0e0e0; padding:4px; margin-top:0;">■ 상부 작동 순서</h4>
          1. 하부 비상스위치 당김 ➔ 키 우측(노란색) 돌림.<br/>
          2. 상부 비상스위치 당김 ➔ 5초 후 조이스틱 LED 점등 확인.<br/>
          3. 풋스위치를 밟은 상태에서 조이스틱 상단 조향버튼 조작.
        </div>
      </div>

      <div style="border:1px solid #000; padding:12px; font-size:11px; background:#fafafa;">
        <h4 style="font-size:13px; font-weight:bold; margin-top:0;">⚠️ 주의사항</h4>
        • 조이스틱 스위치 등에 테이프/끈을 고정하면 에러가 발생하여 작동되지 않습니다.<br/>
        • 장비 경사각 허용치 초과 시 경보음이 울리며 상승이 자동 차단됩니다.<br/>
        • 이상 발생 시 즉시 비상정지 버튼을 누르고 A/S 센터(031-334-5296)로 연락하세요.
      </div>
    </div>
  `);

  // 📄 Page 11: SINOBOOM 비상하강 작동방법
  pages.push(`
    <div style="${commonStyle}">
      <h2 style="text-align:center; font-size:22px; font-weight:bold; margin-bottom:30px; border-bottom:3px solid #0288d1; padding-bottom:10px;">
        SINOBOOM 비상하강 작동방법
      </h2>
      <div style="text-align:center; padding:40px; border:2px solid #0288d1; background:#e1f5fe; border-radius:8px; margin-top:60px;">
        <h1 style="font-size:28px; color:#0277bd; margin-bottom:20px;">🚨 비상시 하강 조작법</h1>
        <p style="font-size:18px; font-weight:bold; color:#d32f2f; line-height:1.8;">
          비상시 장비 하부 뒤쪽에 위치한<br/>
          <span style="font-size:24px; text-decoration:underline;">[빨간색 비상하강 손잡이]</span>를 당겨주세요.
        </p>
      </div>
    </div>
  `);

  // 📄 Page 12: 당해 연도 생산물배상책임(PL)보험 증권
  pages.push(`
    <div style="${commonStyle}">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:16px;">
        <h2 style="font-size:20px; font-weight:bold; margin:0;">생산물배상책임(PL)보험 증권 (당해 기간)</h2>
        <span style="font-size:12px; font-weight:bold; color:#1565c0; border:1px solid #1565c0; padding:3px 8px; borderRadius:4px;">
          가입기간: ${currentInsStart} ~ ${currentInsEnd}
        </span>
      </div>

      <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:11px; margin-bottom:20px;">
        <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold; width:20%;">계약번호</td><td style="padding:6px;">202602-033</td><td style="padding:6px; background:#f0f0f0; font-weight:bold; width:20%;">계약일자</td><td style="padding:6px;">2026년 02월 04일</td></tr>
        <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold;">보험계약자</td><td style="padding:6px;">(주)기연리프트</td><td style="padding:6px; background:#f0f0f0; font-weight:bold;">사업자번호</td><td style="padding:6px;">138-81-83251</td></tr>
        <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold;">피보험자</td><td colSpan="3" style="padding:6px;">(주)기연리프트 (경기도 용인시 처인구 모현읍 갈담로112번길 21-3)</td></tr>
        <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold;">보상한도액</td><td colSpan="3" style="padding:6px; font-weight:bold; color:blue;">1청구당 ₩500,000,000 / 총보상한도액 ₩500,000,000 (국내 생산물)</td></tr>
      </table>
      <p style="font-size:12px; text-align:center; margin-top:40px; font-weight:bold;">대한상공회의소 PL센터 / 현대해상화재보험(주)</p>
    </div>
  `);

  // 📄 Page 13 (조건부 추가): 차기/갱신 생산물배상책임(PL)보험 증권 (계약 만료일 초과 시 자동 첨부)
  if (needsRenewalInsurance) {
    pages.push(`
      <div style="${commonStyle}">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #d32f2f; padding-bottom:8px; margin-bottom:16px;">
          <h2 style="font-size:19px; font-weight:bold; margin:0; color:#b71c1c;">
            생산물배상책임(PL)보험 증권 (차기 갱신 보장)
          </h2>
          <span style="font-size:11px; font-weight:bold; color:#b71c1c; background:#ffebee; border:1px solid #d32f2f; padding:3px 8px; borderRadius:4px;">
            ⚠️ 계약기간 만료일 초과에 따른 차기 증서 추가 결합
          </span>
        </div>

        <div style="padding:10px; background:#fff8e1; border:1px solid #ffe082; borderRadius:6px; font-size:11px; margin-bottom:16px; color:#5d4037;">
          💡 <strong>안전검토 확인필:</strong> 본 렌탈 계약 기간(${cDate} ~ ${cEndDate || '종료일 미정 장기'})이 당해 보험 만료일(${currentInsEnd})을 초과함에 따라, 전 기간 연속 보장을 증명하는 <strong>차기 갱신 보험증권 (${nextInsStart} ~ ${nextInsEnd})</strong>을 함께 통합 첨부합니다.
        </div>

        <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-size:11px; margin-bottom:20px;">
          <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold; width:20%;">계약번호</td><td style="padding:6px;">202702-099 (갱신증권)</td><td style="padding:6px; background:#f0f0f0; font-weight:bold; width:20%;">유효기간</td><td style="padding:6px; font-weight:bold; color:#b71c1c;">${nextInsStart} ~ ${nextInsEnd}</td></tr>
          <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold;">보험계약자</td><td style="padding:6px;">(주)기연리프트</td><td style="padding:6px; background:#f0f0f0; font-weight:bold;">사업자번호</td><td style="padding:6px;">138-81-83251</td></tr>
          <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold;">피보험자</td><td colSpan="3" style="padding:6px;">(주)기연리프트 (경기도 용인시 처인구 모현읍 갈담로112번길 21-3)</td></tr>
          <tr><td style="padding:6px; background:#f0f0f0; font-weight:bold;">보상한도액</td><td colSpan="3" style="padding:6px; font-weight:bold; color:blue;">1청구당 ₩500,000,000 / 총보상한도액 ₩500,000,000 (국내 생산물)</td></tr>
        </table>
        <p style="font-size:12px; text-align:center; margin-top:40px; font-weight:bold;">대한상공회의소 PL센터 / 현대해상화재보험(주)</p>
      </div>
    `);
  }

  // 📄 Page 14 (또는 15): 사업자등록증
  pages.push(`
    <div style="${commonStyle}">
      <div style="border:3px double #000; padding:20px; height:92%; box-sizing:border-box; text-align:center;">
        <h1 style="font-size:26px; font-weight:bold; letter-spacing:10px; margin:20px 0;">사 업 자 등 록 증</h1>
        <p style="font-size:14px; font-weight:bold; margin-bottom:30px;">( 법인사업자 )</p>
        <p style="font-size:16px; font-weight:bold; margin-bottom:30px;">등록번호 : 138-81-83251</p>
        <div style="text-align:left; font-size:12px; line-height:2.2; padding-left:20px;">
          <p><strong>법 인 명 :</strong> 주식회사 기연리프트</p>
          <p><strong>대 표 자 :</strong> 이수용</p>
          <p><strong>개업연월일 :</strong> 2013년 04월 03일</p>
          <p><strong>사업장 소재지 :</strong> 경기도 용인시 처인구 모현읍 갈담로112번길 21-3</p>
          <p><strong>사업의 종류 :</strong> [업태] 사업지원및임대서비스업 &nbsp; [종목] 고소장비임대업</p>
        </div>
        <h3 style="font-size:20px; font-weight:bold; margin-top:60px;">용 인 세 무 서 장 (인)</h3>
      </div>
    </div>
  `);

  // 📄 Page 15 (또는 16): 통장사본
  pages.push(`
    <div style="${commonStyle}">
      <h2 style="text-align:center; font-size:22px; font-weight:bold; margin-bottom:30px; border-bottom:2px solid #000; padding-bottom:8px;">
        통 장 표 지 출 력 (결제 계좌 확인용)
      </h2>
      <div style="border:2px solid #0046ff; padding:30px; border-radius:12px; background:#f4f7ff; text-align:center; margin-top:40px;">
        <h3 style="font-size:20px; color:#0046ff; margin-bottom:20px; font-weight:bold;">신한은행 (SHINHAN BANK)</h3>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:20px;">
          <tr><td style="padding:10px; font-weight:bold; text-align:right; width:40%;">예 금 주 :</td><td style="padding:10px; font-weight:bold; text-align:left;">주식회사 기연리프트</td></tr>
          <tr><td style="padding:10px; font-weight:bold; text-align:right;">계 좌 번 호 :</td><td style="padding:10px; font-weight:bold; text-align:left; color:#d32f2f; font-size:18px;">140-010-007060</td></tr>
          <tr><td style="padding:10px; font-weight:bold; text-align:right;">상 품 명 :</td><td style="padding:10px; text-align:left;">기업자유예금</td></tr>
        </table>
      </div>
    </div>
  `);

  return pages;
}

// ──────────────────────────────────────────────────────────────────────────────
// 단일 PDF 생성 메인 함수
// ──────────────────────────────────────────────────────────────────────────────
export async function downloadContractDocumentBundlePdf(options?: SampleContractBundleOptions): Promise<void> {
  const pagesHtml = generateBundleHTML(options);

  // 임시 비가시 렌더링 컨테이너 생성
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();  // 210mm
    const pdfH = pdf.internal.pageSize.getHeight(); // 297mm

    for (let i = 0; i < pagesHtml.length; i++) {
      container.innerHTML = pagesHtml[i];
      const targetEl = container.firstElementChild as HTMLElement;

      const canvas = await html2canvas(targetEl, {
        scale: 1.8,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 700,
        windowWidth: 700,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.88);

      if (i > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    }

    const cName = options?.customerName || '세보엠이씨';
    const pageCount = pagesHtml.length;
    const fileName = `[기연리프트]_통합출고계약서류팩_${cName}_(${pageCount}p).pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}
