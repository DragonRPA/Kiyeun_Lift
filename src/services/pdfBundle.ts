// src/services/pdfBundle.ts
// (주)기연리프트 계약서 7종 통합 서류팩 PDF 자동 조립 및 병합 엔진 (pdf-lib 기반)
//
// ⚠️ 문서 변조 리스크 전면 차단 원칙:
// 타 기관 발행 서류(KCs 안전인증서, 작동법, PL보험증권, 사업자등록증, 통장사본)는
// HTML 모방 렌더링을 금지하며, Cloudflare R2 스토리지의 원본 PDF 바이너리를 그대로 복사하여 병합합니다.

import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';

export interface ContractBundleAssetItem {
  assetNo: string;
  modelName: string;
  sn: string;
  rentalFee: number;
  manufacturer?: string;
  manufactureYear?: string | number;
  weight?: string;
  workingHeight?: string;
  platformHeight?: string;
  capacityPreExt?: string;
  certDate?: string;
}

export interface ContractFullBundleOptions {
  customerName?: string;
  bizRegNo?: string;
  ceoName?: string;
  contractDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  deliveryDate?: string;
  siteName?: string;
  siteAddress?: string;
  contractNo?: string;
  managerName?: string;
  managerPhone?: string;
  siteManagerName?: string;
  siteManagerPhone?: string;
  salesRepName?: string;
  salesRepPhone?: string;
  optionsText?: string;
  remarksText?: string;
  currentInsuranceStartDate?: string;
  currentInsuranceEndDate?: string;
  nextInsuranceStartDate?: string;
  nextInsuranceEndDate?: string;
  assets?: ContractBundleAssetItem[];
  r2Config?: {
    accountId?: string;
    bucketName?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicDomain?: string;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. ERP 동적 서류 HTML 렌더러 (1.계약서, 2.반입전체크리스트, 3.안전점검결과서)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 📄 1. 고소작업대 임대차 계약서 HTML 생성 (첨부 실물과 100% 동일한 A4 레이아웃)
 */
export function buildContractPageHtml(opts: ContractFullBundleOptions): string {
  const cName = opts.customerName || '주식회사 세보엠이씨';
  const cBizNo = opts.bizRegNo || '118-81-00241';
  const cCeo = opts.ceoName || '김우영, 이원하';
  const cDate = opts.contractDate || opts.contractStartDate || '2026년 2월 24일';
  const sName = opts.siteName || '평택삼성전자 P4';
  const sAddr = opts.siteAddress || '경기 평택시 고덕면 여염리 산 157';
  const dDate = opts.deliveryDate || opts.contractStartDate || '2026년 2월 27일 금요일';
  const repName = opts.salesRepName || '김동우 팀장';
  const repPhone = opts.salesRepPhone || '010-9402-5296';
  const siteMgr = opts.siteManagerName || opts.managerName || '장효준 선임';
  const siteMgrPhone = opts.siteManagerPhone || opts.managerPhone || '010-7723-0285';

  const assetList = opts.assets && opts.assets.length > 0 ? opts.assets : [
    { assetNo: 'G26006', modelName: 'GS-2646', sn: 'GS46D-13045', rentalFee: 480000 },
    { assetNo: 'G26008', modelName: 'GS-2646', sn: 'GS46D-13049', rentalFee: 480000 },
    { assetNo: 'G2375', modelName: 'GS-2646 E', sn: 'GS46D-24106', rentalFee: 480000 },
  ];

  const totalRentalFee = assetList.reduce((sum, a) => sum + (Number(a.rentalFee) || 0), 0);

  return `
    <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000; background: #fff; width: 794px; height: 1123px; padding: 36px 44px; box-sizing: border-box; position: relative;">
      <h1 style="text-align: center; font-size: 24px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: 3px;">고소작업대 임대차 계약서</h1>
      <p style="text-align: center; font-size: 13px; font-weight: bold; margin: 0 0 14px 0;">${cDate}</p>

      <!-- 갑/을 정보 테이블 -->
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 12px; margin-bottom: 8px;">
        <tr>
          <td rowSpan="3" style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; text-align: center; width: 10%; background: #f8fafc;">임대인 (갑)</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; width: 12%;">등록번호</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; width: 28%; font-weight: bold; letter-spacing: 1px;">138-81-83251</td>
          <td rowSpan="3" style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; text-align: center; width: 10%; background: #f8fafc;">임차인 (을)</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; width: 12%;">등록번호</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; width: 28%; font-weight: bold; letter-spacing: 1px;">${cBizNo}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center;">상 호</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">주식회사 기연리프트</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center;">상 호</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${cName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center;">대 표 자</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">이 수 용 (인)</td>
          <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center;">대 표 자</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${cCeo}</td>
        </tr>
      </table>

      <p style="text-align: center; font-size: 11px; margin: 4px 0 10px 0; color: #333;">
        임대인과 임차인은 아래의 내용과 같이 임대차 계약을 체결하고, 계약서에 명시된 계약조건을 증명하기 위하여 본계약서를 2부 작성하여 각 1부씩 보관한다.
      </p>

      <div style="font-size: 14px; font-weight: bold; text-align: center; margin: 6px 0; letter-spacing: 2px;">임대차 계약 내용</div>

      <!-- 현장 및 인도 상세 -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11.5px; margin-bottom: 8px;">
        <tr>
          <td style="border: 1px solid #000; padding: 5px; font-weight: bold; text-align: center; width: 14%; background: #f8fafc;">장비 인도장소</td>
          <td style="border: 1px solid #000; padding: 5px 8px; width: 36%;">${sName}</td>
          <td style="border: 1px solid #000; padding: 5px; font-weight: bold; text-align: center; width: 16%; background: #f8fafc;">장비 인도 예정일</td>
          <td style="border: 1px solid #000; padding: 5px 8px; width: 34%; font-weight: bold;">${dDate}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 5px; font-weight: bold; text-align: center; background: #f8fafc;">현장 상세 위치</td>
          <td colSpan="3" style="border: 1px solid #000; padding: 5px 8px;">${sAddr}</td>
        </tr>
        <tr>
          <td rowSpan="2" style="border: 1px solid #000; padding: 5px; font-weight: bold; text-align: center; background: #f8fafc;">임차 신청자<br/><span style="font-size:10px; font-weight:normal;">(임차인의 대리인)</span></td>
          <td style="border: 1px solid #000; padding: 4px 8px;">상호(법인명): <strong>${cName}</strong></td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; background: #f8fafc; font-weight: bold;">사무실</td>
          <td style="border: 1px solid #000; padding: 4px 8px;">팩스: -</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px 8px;">현장 담당자: <strong>${siteMgr}</strong></td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; background: #f8fafc; font-weight: bold;">핸드폰</td>
          <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">${siteMgrPhone}</td>
        </tr>
      </table>

      <!-- 품목 자산 테이블 -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; text-align: center; margin-bottom: 8px;">
        <thead>
          <tr style="background: #f8fafc; font-weight: bold;">
            <th style="border: 1px solid #000; padding: 5px; width: 16%;">품목(모델명)</th>
            <th style="border: 1px solid #000; padding: 5px; width: 8%;">수량</th>
            <th style="border: 1px solid #000; padding: 5px; width: 22%;">장비 번호(S/N)</th>
            <th style="border: 1px solid #000; padding: 5px; width: 14%;">임대료<br/><span style="font-size:9.5px; font-weight:normal;">(1대/1개월)</span></th>
            <th style="border: 1px solid #000; padding: 5px; width: 14%;">소계</th>
            <th style="border: 1px solid #000; padding: 5px; width: 12%;">운송료</th>
            <th style="border: 1px solid #000; padding: 5px; width: 14%;">합계</th>
          </tr>
        </thead>
        <tbody>
          ${assetList.map((a, idx) => `
            <tr>
              <td style="border: 1px solid #000; padding: 4px;">${a.modelName}</td>
              <td style="border: 1px solid #000; padding: 4px;">1</td>
              <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">
                ${a.assetNo}<br/><span style="font-size: 9.5px; color: #444; font-weight: normal;">(${a.sn || '-'})</span>
              </td>
              <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(Number(a.rentalFee) || 0).toLocaleString()}</td>
              <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(Number(a.rentalFee) || 0).toLocaleString()}</td>
              ${idx === 0 ? `
                <td rowSpan="${assetList.length}" style="border: 1px solid #000; padding: 6px; font-size: 10px; font-weight: bold; background: #fff;">
                  [운송료<br/>청구기준<br/>참조]
                </td>
                <td rowSpan="${assetList.length}" style="border: 1px solid #000; padding: 6px; font-weight: bold; font-size: 13px; text-align: right; background: #fff;">
                  ₩${totalRentalFee.toLocaleString()}
                  <div style="font-size: 9.5px; font-weight: normal; color: #555; margin-top: 4px;">부가세 별도<br/>/<br/>운송료 별도</div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- 운송료 및 조항 -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10px; margin-bottom: 8px;">
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold; text-align: center; width: 14%; background: #f8fafc;">운송료 청구 기준</td>
          <td colSpan="3" style="border: 1px solid #000; padding: 4px 8px;">
            ■ 2개월 이하: 왕복 운반비 임차인 부담 &nbsp;&nbsp;■ 4개월 이하: 편도 운반비 임차인 부담 &nbsp;&nbsp;■ 4개월 초과 : 왕복 운반비 임대인 부담
          </td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold; text-align: center; background: #f8fafc;">옵 션</td>
          <td colSpan="3" style="border: 1px solid #000; padding: 4px 8px;">${opts.optionsText || '-'}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold; text-align: center; background: #f8fafc;">첨부서류</td>
          <td colSpan="3" style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">
            계약서, 작동법, 반입전체크리스트, 안전점검결과서, 안전인증서, 보험증권, 사업자등록증, 통장사본
          </td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold; text-align: center; background: #f8fafc;">특이사항</td>
          <td colSpan="3" style="border: 1px solid #000; padding: 4px 8px;">* 1개월 미만 사용시 1개월분 임대료가 청구 됩니다.</td>
        </tr>
      </table>

      <!-- 건설기계 사용시 주의 사항 -->
      <div style="border: 1.5px solid #000; padding: 6px 10px; font-size: 9.5px; line-height: 1.45; margin-bottom: 6px;">
        <strong>건설기계 사용시 주의 사항:</strong><br/>
        • 지게차 및 크레인을 이용한 장비 상·하차비용은 임차인이 전액 부담합니다.<br/>
        • 계약기간 만료후 반납통보가 없을시에는 자동으로 임대계약이 연장되며, 반납시 임차인은 장비를 운반차량에 실어 주셔야합니다.<br/>
        • 임차인의 요청에 따른 옵션 장착으로 인해 발생한 사고는 임차인이 책임집니다.<br/>
        • 임차인의 관리 소홀 및 과실로 발생한 장비의 파손·해체·오염등에 의한 수리비 및 훼손 복구비용은 임차인이 부담합니다.<br/>
        • 그외 기타 사항은 건설기계임대차 표준계약서[공정거래위원회 표준약관 제10059호]의 일반 조건에 따릅니다.
      </div>

      <div style="border: 1px solid #000; padding: 4px 10px; font-size: 10.5px; margin-bottom: 6px; background: #f8fafc;">
        <strong>결제 계좌:</strong> 신한은행 140-010-007060 예금주: 주식회사 기연리프트
      </div>

      <div style="border: 1.5px solid #000; padding: 6px 10px; font-size: 10px; line-height: 1.4; margin-bottom: 8px;">
        <strong>장비 인수자 확인 서명란:</strong> 건설장비 임대계약에 따라 인도받은 임대 물건의 작동법과 관리방법을 습득한후 하자여부를 확인하여 정상적으로 사용가능한 상태에서 장비를 인수하였음을 확인합니다.<br/>
        <div style="display: flex; justify-content: flex-end; gap: 40px; margin-top: 4px;">
          <span>장비 인수자: ____________________ (서명)</span>
          <span>핸드폰: ____________________</span>
        </div>
      </div>

      <!-- 하단 회사 및 영업 담당자 정보 -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9.5px;">
        <tr>
          <td style="border: 1px solid #000; padding: 4px 8px; width: 50%;">
            <strong>본사/공장:</strong> 경기도 용인시 처인구 모현읍 갈담로112번길 21-3<br/>
            <strong>영업 사무소:</strong> 경기도 용인시 기흥구 기흥로 60-1, C동1004호(기흥ICT밸리)
          </td>
          <td style="border: 1px solid #000; padding: 4px 8px; width: 25%;">
            <strong>A/S 접수 ☎</strong> 031-334-5296<br/>
            [평일: 08:00~17:00 / 토: 08:00~17:00]
          </td>
          <td style="border: 1px solid #000; padding: 4px 8px; width: 25%; text-align: center;">
            <strong>영업 담당자</strong><br/>
            [ ${repName} ] ${repPhone}
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * 📄 2. 자산별 반입 전 CHECK LIST HTML 생성 (자산 1대당 1페이지)
 */
export function buildChecklistPageHtml(ast: ContractBundleAssetItem): string {
  const inspector = '김관주';

  return `
    <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000; background: #fff; width: 794px; height: 1123px; padding: 32px 38px; box-sizing: border-box; position: relative;">
      <h2 style="text-align: center; font-size: 16px; font-weight: bold; margin: 0 0 10px 0; border-bottom: 2px solid #000; padding-bottom: 6px; letter-spacing: 1px;">
        ( 모델명: ${ast.modelName} ) ▣ 반입 전 CHECK LIST ( 관리번호: ${ast.assetNo} )
      </h2>

      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 9px; text-align: center;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: bold; font-size: 9.5px;">
            <th style="border: 1px solid #000; padding: 3px; width: 4%;">NO</th>
            <th style="border: 1px solid #000; padding: 3px; width: 22%;">내 용</th>
            <th style="border: 1px solid #000; padding: 3px; width: 10%;">검사기준</th>
            <th style="border: 1px solid #000; padding: 3px; width: 5%;">불량</th>
            <th style="border: 1px solid #000; padding: 3px; width: 5%;">양호</th>
            <th style="border: 1px solid #000; padding: 3px; width: 6%;">점검자</th>
            <th style="border: 1px solid #000; padding: 3px; width: 4%;">NO</th>
            <th style="border: 1px solid #000; padding: 3px; width: 22%;">내 용</th>
            <th style="border: 1px solid #000; padding: 3px; width: 10%;">검사기준</th>
            <th style="border: 1px solid #000; padding: 3px; width: 5%;">불량</th>
            <th style="border: 1px solid #000; padding: 3px; width: 5%;">양호</th>
            <th style="border: 1px solid #000; padding: 3px; width: 6%;">점검자</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1~9: 입고검사 / 36~42: 전기장치 -->
          <tr><td style="border: 1px solid #000; padding: 2px;">1</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">장비외관상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="9" style="border: 1px solid #000; font-weight: bold;">${inspector}</td><td style="border: 1px solid #000; padding: 2px;">36</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">배터리,장비 연결잭</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="7" style="border: 1px solid #000; font-weight: bold;">${inspector}</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">2</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">스위치류 작동,외관상태</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">37</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">배터리 터미널 조임</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">3</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">주행전.후진</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">38</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">배터리비중/부하시험(v)</td><td style="border: 1px solid #000;">5.25V이상</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">4</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">리프트업 주행(주행차단)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">39</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">배터리증류수극판위10MM</td><td style="border: 1px solid #000;">10mm이상</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">5</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">고속,저속 주행</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">40</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">하부리프트작동</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">6</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">조향 좌.우회전</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">41</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">경광등</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">7</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">리프트업.다운</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">42</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">노면접지</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">8</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">엔진시동</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">43</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">도장/세차상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="6" style="border: 1px solid #000; font-weight: bold;">${inspector}</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">9</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">소음 및 보조지지대 작동</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">44</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">바퀴조임상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>

          <!-- 10~13: 세차 / 45~50: 차체, 도장 -->
          <tr><td style="border: 1px solid #000; padding: 2px;">10</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">이물질제거</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="4" style="border: 1px solid #000; font-weight: bold;">${inspector}</td><td style="border: 1px solid #000; padding: 2px;">45</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">엑슬킹핀</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">11</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">세차</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">46</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">허브어셈블리</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">12</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">차체파손 유,무</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">47</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">타이어 마모정도</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">13</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">에어건조</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">48</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">하부도어 잠금장치</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>

          <!-- 14~17: 도장 / 49~56: 씨져, 확장대 -->
          <tr><td style="border: 1px solid #000; padding: 2px;">14</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">도장</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="4" style="border: 1px solid #000; font-weight: bold;">${inspector}</td><td style="border: 1px solid #000; padding: 2px;">49</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">씨져핀 이상</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="8" style="border: 1px solid #000; font-weight: bold;">${inspector}</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">15</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">차체파손 유,무</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">50</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">씨져 외관</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">16</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">관리번호(제조번호)확인</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">51</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">폿홀시스템</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">17</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">스티커 부착상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">52</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">확장대 작동</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>

          <!-- 18~26: 유압 / 57~64: 출고정비 -->
          <tr><td style="border: 1px solid #000; padding: 2px;">18</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">유압 오일양(리프트하강후)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="9" style="border: 1px solid #000; font-weight: bold;">${inspector}</td><td style="border: 1px solid #000; padding: 2px;">53</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">확장대 로울러</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">19</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">리프트실린더(작동/누유)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">54</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">확장대 고정핀</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">20</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">비상하강</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">55</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">안전고리(체인/도어)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">21</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">누유(블록/호스/니쁠)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">56</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">그리스 주입</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">22</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">브레이크(작동/누유)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">57</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">주행(전진/후진)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="8" style="border: 1px solid #000; font-weight: bold;">${inspector}</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">23</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">스티어링(작동/누유)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">58</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">리프트(상승/하강)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">24</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">주행모터(작동/누유)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">59</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">주행차단(현장기준)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">25</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">주행해제(프리휠링벨브)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">60</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">감지봉작동</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">26</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">비상펌프작동</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">61</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">외관상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>

          <!-- 27~35: 전기장치 / 65~71: 옵션장착 -->
          <tr><td style="border: 1px solid #000; padding: 2px;">27</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">전기배선상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="9" style="border: 1px solid #000; font-weight: bold;">${inspector}</td><td style="border: 1px solid #000; padding: 2px;">62</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">배터리충전상태</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">28</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">콘트롤박스 (작동/스티커)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">63</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">폿홀시스템</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">29</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">연결잭(감지봉/풋스위치)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">64</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">옵션작동(기능적)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">30</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">과상승방지봉</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">65</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">보호망(함석 외)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td rowSpan="7" style="border: 1px solid #000; font-weight: bold;">${inspector}</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">31</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">주행차단</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">66</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">협착난간대</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">32</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">풋스위치</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">67</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">타이어 세척</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">33</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">작동알람</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">68</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">충격흡수</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">34</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">충전플러그</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">69</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">용접보호판</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td style="border: 1px solid #000; padding: 2px;">35</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">충전기작동값26A이하</td><td style="border: 1px solid #000;">20.7A</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; padding: 2px;">70</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">부착물(스티커)</td><td style="border: 1px solid #000;">육안</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td></tr>
          <tr><td colSpan="6" style="border: 1px solid #000; padding: 2px;"></td><td style="border: 1px solid #000; padding: 2px;">71</td><td style="border: 1px solid #000; text-align: left; padding-left: 4px;">낙하물방지턱(현장기준)</td><td style="border: 1px solid #000;">작동</td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;">○</td><td style="border: 1px solid #000; font-weight: bold;">${inspector}</td></tr>
        </tbody>
      </table>

      <div style="font-size: 10px; margin-top: 10px; line-height: 1.5; color: #111;">
        ※ 주의 : 1. 기준은 출고시에 점검 체크 기준이며 배터리 충전 상태에 따라 성능이 달라질 수 있습니다.<br/>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. 사용중 배터리의 충전상태 장비의 노후 상태에 따라 속도의 차이가 발생할 수 있습니다.
      </div>
    </div>
  `;
}

/**
 * 📄 3. 자산별 안전점검 결과서 HTML 생성 (자산 1대당 1페이지)
 */
export function buildInspectionPageHtml(ast: ContractBundleAssetItem, opts: ContractFullBundleOptions): string {
  const cName = opts.customerName || '㈜세보엠이씨';
  const mfr = ast.manufacturer || 'GENIE (주)기연리프트';
  const weight = ast.weight || '1,956 kg';
  const speed = '3.5 Km/h';
  const workingH = ast.workingHeight || '9.92 M';
  const cap = ast.capacityPreExt || '454 kg';
  const mfgYear = ast.manufactureYear || '2018';
  const certDate = ast.certDate || '2010-12-29';
  const inspectDate = opts.contractStartDate || '2026-02-26';
  const inspector = '김관주';

  return `
    <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; color: #000; background: #fff; width: 794px; height: 1123px; padding: 30px 38px; box-sizing: border-box; position: relative;">
      <h2 style="text-align: center; font-size: 16px; font-weight: bold; margin: 0 0 10px 0; letter-spacing: 2px;">
        고소작업대(T/L) 안전점검 결과서
      </h2>

      <!-- 상단 메타데이터 테이블 -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 10.5px; text-align: center; margin-bottom: 8px;">
        <tr>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold; width: 14%;">사업장명</td>
          <td style="border: 1px solid #000; padding: 4px; width: 20%;"></td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold; width: 14%;">형 식</td>
          <td style="border: 1px solid #000; padding: 4px; width: 18%;">수직상승형<br/>고소작업대</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold; width: 16%;">제 조 사(렌탈사)</td>
          <td style="border: 1px solid #000; padding: 4px; width: 18%; font-weight: bold;">${mfr}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">사용업체</td>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${cName}</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">동력전달방식</td>
          <td style="border: 1px solid #000; padding: 4px;">배터리충전식</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">모델명</td>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${ast.modelName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">장비중량</td>
          <td style="border: 1px solid #000; padding: 4px;">${weight}</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">운행속도</td>
          <td style="border: 1px solid #000; padding: 4px;">${speed}</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">작업최대높이/적재용량</td>
          <td style="border: 1px solid #000; padding: 4px;">${workingH} &nbsp;|&nbsp; ${cap}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">차량번호</td>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold; color: #1e3a8a;">${ast.assetNo}</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">제조년도</td>
          <td style="border: 1px solid #000; padding: 4px;">${mfgYear}</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">안전인증년월일</td>
          <td style="border: 1px solid #000; padding: 4px;">${certDate}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">안전점검일시</td>
          <td style="border: 1px solid #000; padding: 4px;">${inspectDate}</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">점검부서</td>
          <td style="border: 1px solid #000; padding: 4px;">정비팀</td>
          <td style="border: 1px solid #000; padding: 4px; background: #f8fafc; font-weight: bold;">점검자</td>
          <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">
            ${inspector} (인)
          </td>
        </tr>
      </table>

      <!-- 8대 검사항목 상세 테이블 -->
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8.8px; text-align: left;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: bold; text-align: center; font-size: 9.5px;">
            <th style="border: 1px solid #000; padding: 4px; width: 18%;">검사부분</th>
            <th style="border: 1px solid #000; padding: 4px; width: 68%;">검사항목</th>
            <th style="border: 1px solid #000; padding: 4px; width: 8%;">검사결과</th>
            <th style="border: 1px solid #000; padding: 4px; width: 6%;">조치사항</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td rowSpan="3" style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">1. 공통사항<br/><span style="font-weight:normal;">⑴ 등록번호표 등</span></td>
            <td style="border: 1px solid #000; padding: 3px 5px;">제조일로부터 15년 이내의 장비일 것</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">붐대, 아웃트리거, 용접부등 비파괴 검사 성적서 비치되어 있을것</td>
            <td style="border: 1px solid #000; text-align: center;">ㅡ</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">운전원은 장비의 운전 및 안전에 대한 교육을 받은 유경험자이고 보험(자차 등)에 가입되어 있을것</td>
            <td style="border: 1px solid #000; text-align: center;">ㅡ</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td rowSpan="2" style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">2. 차대와 타이어(안정기)<br/><span style="font-weight:normal;">⑴ 차체 및 타이어<br/>⑵ 동력원</span></td>
            <td style="border: 1px solid #000; padding: 3px 5px;">차체의 균열, 변형, 손상 및 부식이 없을것 / 타이어 이상마모 및 변형 없고 림볼트, 너트 견고 체결</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">유압펌프·모터 진동/이상음 없고 유압실린더,호스,파이프 누유 없으며 배선 열화 없을 것</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">3. 연장구조물(마스트)<br/><span style="font-weight:normal;">⑴ 구조부</span></td>
            <td style="border: 1px solid #000; padding: 3px 5px;">고정받침대 구비, 구조물 균열·변형 없고 힌지 핀 고정상태 양호하며 잠금밸브 정상 작동</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td rowSpan="2" style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">4. 작업대<br/><span style="font-weight:normal;">⑴ 낙하·추락방지<br/>⑵ 접근사다리</span></td>
            <td style="border: 1px solid #000; padding: 3px 5px;">난간높이 1.0m 이상, 발끝막이판 0.15m 이상, 중간대(0.55m 이내) 설치 및 바닥면 미끄럼 방지</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">작업대 바닥높이가 지면에서 0.4m 초과시 접근사다리를 설치할 것</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">5. 제어장치<br/><span style="font-weight:normal;">⑴ 제어장치</span></td>
            <td style="border: 1px solid #000; padding: 3px 5px;">조작 해제 시 자동으로 중립위치 복귀, 작동방향 표기 및 우발 동작 방지 상호 연동장치(인에이블 스위치) 구비</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">6. 표시<br/><span style="font-weight:normal;">⑴ 경고 표시</span></td>
            <td style="border: 1px solid #000; padding: 3px 5px;">명판에 제조자명, 모델명, 제조번호, 정격하중, 풍속, 안전인증 등 표시 및 비상안전장치 위치/사용법 표시</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td rowSpan="3" style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">7. 점등 및 조명장치 등</td>
            <td style="border: 1px solid #000; padding: 3px 5px;">전조등, 미등, 방향지시등, 경광등, 작업등 손상 없고 점등상태 양호할 것</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">연료계, 유량계, 회전계, 압력계 등 계기장치 작동상태 양호할 것</td>
            <td style="border: 1px solid #000; text-align: center;">ㅡ</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">경음기 및 경보장치의 음의 크기는 기준의 범위 이내일 것</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td rowSpan="4" style="border: 1px solid #000; padding: 3px 5px; font-weight: bold; vertical-align: top;">8. 안전장치</td>
            <td style="border: 1px solid #000; padding: 3px 5px;">(1) 자동안전장치: 작업대 상승 상태 차대 이동 시 주행속도 자동 제한 장치 구비</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">(2) 경사표시장치(전복방지장치): 차대 경사 초과 시 상승/주행 불가능 및 경보음 발생</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">(3) 비상정지장치: 적색 돌출형 수동복귀 누름버튼 정상 작동</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 3px 5px;">(4) 비상안전장치: 동력 차단 시 작업대를 안전하게 복귀시킬 수 있는 비상하강밸브 구비</td>
            <td style="border: 1px solid #000; text-align: center; font-weight: bold;">O</td>
            <td style="border: 1px solid #000;"></td>
          </tr>

          <tr>
            <td style="border: 1px solid #000; padding: 6px 5px; font-weight: bold;">검사자 의견</td>
            <td colSpan="3" style="border: 1px solid #000; padding: 6px 5px; color: #444;">특이사항 없음 (전 항목 정상 작동 및 출고 점검 완료)</td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 8.5px; margin-top: 6px; color: #555;">
        * 검사결과 표시 : 양호 ○, 조정(보완)△, 교환□, 제작(설치)Φ, 폐기×, 해당무-
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Cloudflare R2 원본 PDF 바이너리 다운로드 헬퍼
// ──────────────────────────────────────────────────────────────────────────────

async function fetchR2PdfBytes(key: string, publicDomain: string = 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev'): Promise<ArrayBuffer | null> {
  // 1순위: 로컬 에이전트 캐시 (127.0.0.1:5175)
  try {
    const localRes = await fetch(`http://127.0.0.1:5175/api/get-file?fileName=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(1200) });
    if (localRes.ok) {
      const ab = await localRes.arrayBuffer();
      if (ab.byteLength > 100) return ab;
    }
  } catch (_) {}

  // 2순위: R2 Public CDN
  try {
    const url = `${publicDomain.replace(/\/$/, '')}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 100) return ab;
    }
  } catch (_) {}

  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. 계약서 7종 통합 서류팩 메인 조립 엔진 (PDF-Lib 기반)
// ──────────────────────────────────────────────────────────────────────────────

export async function generateContractFullDocumentBundlePdf(
  options: ContractFullBundleOptions,
  onProgress?: (stepText: string, current: number, total: number) => void
): Promise<{ pdfBytes: Uint8Array; blob: Blob; url: string; pageCount: number; fileName: string }> {

  const mergedPdf = await PDFDocument.create();
  const publicDomain = options.r2Config?.publicDomain || 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev';

  const assetList = options.assets && options.assets.length > 0 ? options.assets : [
    { assetNo: 'G26006', modelName: 'GS-2646', sn: 'GS46D-13045', rentalFee: 480000 },
    { assetNo: 'G26008', modelName: 'GS-2646', sn: 'GS46D-13049', rentalFee: 480000 },
    { assetNo: 'G2375', modelName: 'GS-2646 E', sn: 'GS46D-24106', rentalFee: 480000 },
  ];

  // 투입된 고유 장비 모델 목록 (순서 유지)
  const uniqueModels: string[] = [];
  for (const a of assetList) {
    if (a.modelName && !uniqueModels.includes(a.modelName)) {
      uniqueModels.push(a.modelName);
    }
  }

  const totalSteps = 7;

  // ----------------------------------------------------------------------------
  // 📑 Step 1: 01. 계약서 (1 page)
  // ----------------------------------------------------------------------------
  onProgress?.('01. 고소작업대 임대차 계약서 렌더링 중...', 1, totalSteps);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const contractHtml = buildContractPageHtml(options);
    container.innerHTML = contractHtml;

    const contractCanvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2.0,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const contractJpgBytes = await (await fetch(contractCanvas.toDataURL('image/jpeg', 0.92))).arrayBuffer();
    const contractDoc = await PDFDocument.create();
    const embeddedContract = await contractDoc.embedJpg(contractJpgBytes);
    const p1 = contractDoc.addPage([595.28, 841.89]);
    p1.drawImage(embeddedContract, { x: 0, y: 0, width: 595.28, height: 841.89 });

    const [copiedContract] = await mergedPdf.copyPages(contractDoc, [0]);
    mergedPdf.addPage(copiedContract);

    // ----------------------------------------------------------------------------
    // 📑 Step 2: 02. 자산별 반입 전 CHECK LIST (N pages)
    // ----------------------------------------------------------------------------
    onProgress?.(`02. 자산별 반입 전 자체점검 체크리스트(${assetList.length}대) 렌더링 중...`, 2, totalSteps);

    for (let i = 0; i < assetList.length; i++) {
      const ast = assetList[i];
      container.innerHTML = buildChecklistPageHtml(ast);

      const chkCanvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2.0, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff', width: 794, windowWidth: 794
      });

      const chkJpgBytes = await (await fetch(chkCanvas.toDataURL('image/jpeg', 0.92))).arrayBuffer();
      const chkDoc = await PDFDocument.create();
      const embeddedChk = await chkDoc.embedJpg(chkJpgBytes);
      const chkPage = chkDoc.addPage([595.28, 841.89]);
      chkPage.drawImage(embeddedChk, { x: 0, y: 0, width: 595.28, height: 841.89 });

      const [copiedChk] = await mergedPdf.copyPages(chkDoc, [0]);
      mergedPdf.addPage(copiedChk);
    }

    // ----------------------------------------------------------------------------
    // 📑 Step 3: 03. 자산별 안전점검 결과서 (N pages)
    // ----------------------------------------------------------------------------
    onProgress?.(`03. 자산별 안전점검 결과서(${assetList.length}대) 렌더링 중...`, 3, totalSteps);

    for (let i = 0; i < assetList.length; i++) {
      const ast = assetList[i];
      container.innerHTML = buildInspectionPageHtml(ast, options);

      const insCanvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2.0, useCORS: true, allowTaint: true, logging: false, backgroundColor: '#ffffff', width: 794, windowWidth: 794
      });

      const insJpgBytes = await (await fetch(insCanvas.toDataURL('image/jpeg', 0.92))).arrayBuffer();
      const insDoc = await PDFDocument.create();
      const embeddedIns = await insDoc.embedJpg(insJpgBytes);
      const insPage = insDoc.addPage([595.28, 841.89]);
      insPage.drawImage(embeddedIns, { x: 0, y: 0, width: 595.28, height: 841.89 });

      const [copiedIns] = await mergedPdf.copyPages(insDoc, [0]);
      mergedPdf.addPage(copiedIns);
    }

  } finally {
    document.body.removeChild(container);
  }

  // ----------------------------------------------------------------------------
  // 📑 Step 4: 04. 모델별 Eq_doc/{모델명}/ 하위 정규 서류 일체 (각 1부씩)
  // ----------------------------------------------------------------------------
  onProgress?.(`04. 모델별(${uniqueModels.length}개 모델) R2 정규문서 수집 및 병합 중...`, 4, totalSteps);

  for (const model of uniqueModels) {
    try {
      // 1. R2 API로 해당 모델 폴더의 파일 목록 조회
      const res = await fetch(`/api/r2?action=list&prefix=Eq_doc/${encodeURIComponent(model)}/`);
      let files: Array<{ key: string }> = [];

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.files) {
          files = data.files.filter((f: any) => f.key.endsWith('.pdf'));
        }
      }

      // 만약 API 조회가 비어있으면 표준 파일명 규칙으로 폴백 시도
      if (files.length === 0) {
        files = [
          { key: `Eq_doc/${model}/4.제원표_${model}.pdf` },
          { key: `Eq_doc/${model}/5.안전인증서_${model}.pdf` },
          { key: `Eq_doc/${model}/6.장비작동법_${model}.pdf` },
          { key: `Eq_doc/${model}/7.비상하강작동법_${model}.pdf` }
        ];
      }

      // 파일명 순 정렬 (1.제원표, 2.안전인증서, 3.장비작동법, 4.비상하강 순)
      files.sort((a, b) => a.key.localeCompare(b.key));

      for (const f of files) {
        const pdfBytes = await fetchR2PdfBytes(f.key, publicDomain);
        if (pdfBytes) {
          try {
            const doc = await PDFDocument.load(pdfBytes);
            const copied = await mergedPdf.copyPages(doc, doc.getPageIndices());
            copied.forEach(p => mergedPdf.addPage(p));
          } catch (e) {
            console.warn(`[pdfBundle] 모델 PDF 로드 실패: ${f.key}`, e);
          }
        }
      }
    } catch (modelErr) {
      console.warn(`[pdfBundle] 모델 [${model}] 정규 문서 병합 중 오류:`, modelErr);
    }
  }

  // ----------------------------------------------------------------------------
  // 📑 Step 5: 05. 생산물배상책임(PL)보험증권 (계약기간 보증 1~2 pages)
  // ----------------------------------------------------------------------------
  onProgress?.('05. 생산물배상책임보험증권 (계약기간 보증) 병합 중...', 5, totalSteps);

  const cStartDate = options.contractStartDate || '2026-02-27';
  const cEndDate = options.contractEndDate; // null/undefined면 장기계약

  // 2026년 3월 5일 기준:
  // - 계약 시작일이 2026-03-05 이전이면 2025~2026년 증권 필요
  // - 계약 종료일이 없거나(장기) 2026-03-05 이후이면 2026~2027년 갱신 증권 필요
  const needs2025 = !cStartDate || cStartDate < '2026-03-05';
  const needs2026 = !cEndDate || cEndDate >= '2026-03-05' || cStartDate >= '2026-03-05';

  if (needs2025) {
    const bytes2025 = await fetchR2PdfBytes('08.생산물배상책임보험증권_2025-2026.pdf', publicDomain);
    if (bytes2025) {
      const doc2025 = await PDFDocument.load(bytes2025);
      const pages2025 = await mergedPdf.copyPages(doc2025, doc2025.getPageIndices());
      pages2025.forEach(p => mergedPdf.addPage(p));
    }
  }

  if (needs2026) {
    const bytes2026 = await fetchR2PdfBytes('08.생산물배상책임보험증권_2026-2027.pdf', publicDomain) 
      || await fetchR2PdfBytes('08.생산물배상책임보험증권.pdf', publicDomain);
    if (bytes2026) {
      const doc2026 = await PDFDocument.load(bytes2026);
      const pages2026 = await mergedPdf.copyPages(doc2026, doc2026.getPageIndices());
      pages2026.forEach(p => mergedPdf.addPage(p));
    }
  }

  // ----------------------------------------------------------------------------
  // 📑 Step 6: 06. 사업자등록증 (1 page)
  // ----------------------------------------------------------------------------
  onProgress?.('06. 사업자등록증 (CF R2 원본) 병합 중...', 6, totalSteps);

  const bizBytes = await fetchR2PdfBytes('09.사업자등록증.pdf', publicDomain);
  if (bizBytes) {
    const bizDoc = await PDFDocument.load(bizBytes);
    const bizPages = await mergedPdf.copyPages(bizDoc, bizDoc.getPageIndices());
    bizPages.forEach(p => mergedPdf.addPage(p));
  }

  // ----------------------------------------------------------------------------
  // 📑 Step 7: 07. 통장사본 (1 page)
  // ----------------------------------------------------------------------------
  onProgress?.('07. 통장사본 (CF R2 원본) 병합 중...', 7, totalSteps);

  const bankBytes = await fetchR2PdfBytes('10.통장사본.pdf', publicDomain);
  if (bankBytes) {
    const bankDoc = await PDFDocument.load(bankBytes);
    const bankPages = await mergedPdf.copyPages(bankDoc, bankDoc.getPageIndices());
    bankPages.forEach(p => mergedPdf.addPage(p));
  }

  // 최종 병합 PDF 바이트 저장
  const finalPdfBytes = await mergedPdf.save();
  const blob = new Blob([finalPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const cName = options.customerName || '고객사';
  const sName = options.siteName || '현장';
  const pageCount = mergedPdf.getPageCount();
  const fileName = `[기연리프트]_계약서류팩_${cName}_${sName}(${pageCount}p).pdf`;

  return { pdfBytes: finalPdfBytes, blob, url, pageCount, fileName };
}

// ──────────────────────────────────────────────────────────────────────────────
// 기존 함수 호환성 래퍼 (6종 통합 서류팩 호출 대응)
// ──────────────────────────────────────────────────────────────────────────────

export type SampleContractBundleOptions = ContractFullBundleOptions;

export async function generateCloudflare6DocBundlePdf(
  options: SampleContractBundleOptions,
  onProgress?: (stepText: string, current: number, total: number) => void
): Promise<{ pdfBytes: Uint8Array; blob: Blob; url: string; pageCount: number; fileName: string }> {
  return generateContractFullDocumentBundlePdf(options, onProgress);
}

export async function downloadContractDocumentBundlePdf(options?: SampleContractBundleOptions): Promise<void> {
  const result = await generateContractFullDocumentBundlePdf(options || {});
  const link = document.createElement('a');
  link.href = result.url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(result.url);
}

// ──────────────────────────────────────────────────────────────────────────────
// 구글 드라이브 파일 병합 호환 인터페이스 및 함수
// ──────────────────────────────────────────────────────────────────────────────

export interface DriveFileMergeItem {
  label: string;
  fileId: string;
}

export interface MergeDriveFilesResult {
  successCount: number;
  failedLabels: string[];
  totalPages: number;
}

export interface MergeDriveFilesOptions {
  token?: string;
  appsScriptUrl?: string;
  outputFileName: string;
  onProgress?: (label: string, index: number, total: number) => void;
}

export async function mergeDriveFilesToPdf(
  items: DriveFileMergeItem[],
  options: MergeDriveFilesOptions | string,
  _legacyOutputFileName?: string,
  _legacyOnProgress?: (label: string, index: number, total: number) => void
): Promise<MergeDriveFilesResult> {
  const opts: MergeDriveFilesOptions = typeof options === 'string'
    ? { token: options, outputFileName: _legacyOutputFileName || 'merged.pdf', onProgress: _legacyOnProgress }
    : options;

  const mergedPdf = await PDFDocument.create();
  let successCount = 0;
  const failedLabels: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    opts.onProgress?.(item.label, i + 1, items.length);

    try {
      let arrayBuffer: ArrayBuffer | null = null;
      if (opts.appsScriptUrl) {
        const res = await fetch(`${opts.appsScriptUrl}?action=download&fileId=${item.fileId}`);
        if (res.ok) arrayBuffer = await res.arrayBuffer();
      }
      if (arrayBuffer) {
        const doc = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
        successCount++;
      } else {
        failedLabels.push(item.label);
      }
    } catch (e) {
      failedLabels.push(item.label);
    }
  }

  const totalPages = mergedPdf.getPageCount();
  if (totalPages > 0) {
    const bytes = await mergedPdf.save();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = opts.outputFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return { successCount, failedLabels, totalPages };
}

