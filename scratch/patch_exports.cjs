const fs = require('fs');
const path = require('path');

// Define the exact UI mappings for the requested files
const replacements = {
  'Assets.tsx': {
    target: "const dataToExport = filteredAssets.map((asset, index) => ({",
    replacement: `const dataToExport = filteredAssets.map((asset, index) => ({
      'No': index + 1,
      '관리번호': asset.assetNo || '-',
      '모델명': asset.modelName || '-',
      '제조사': asset.manufacturer || '-',
      '제조번호': asset.serialNo || '-',
      '제조년도': asset.manufactureYear || '-',
      '소유': asset.ownershipType === 'OWNED' ? '당사자산' : asset.ownershipType === 'LEASED' ? '전대임차' : asset.ownershipType === 'SUBLEASE' ? '재임대' : asset.ownershipType,
      '상태': asset.status === 'AVAILABLE' ? '임대가능' : asset.status === 'RENTED' ? '대여중' : asset.status === 'MAINTENANCE' ? '수리중' : asset.status === 'SOLD' ? '매각' : asset.status,
      '현재 고객사': asset.currentCustomerName || '-',
      '현재 현장': asset.currentSiteName || '-',
      '계약번호': asset.contractNumber || '-',
      '계약시작일': asset.contractStartDate || '-',
      '계약종료일': asset.contractEndDate || '-',
      '청구마감일': asset.billingCloseDay ? \`\${asset.billingCloseDay}일\` : '-',
      '월대여료': asset.monthlyRent ? \`\${asset.monthlyRent.toLocaleString()}원\` : '-',
      '일대여료': asset.dailyRent ? \`\${asset.dailyRent.toLocaleString()}원\` : '-',
      '취득일자': asset.acquisitionDate || '-',
      '취득금액': asset.acquisitionCost ? \`\${asset.acquisitionCost.toLocaleString()}원\` : '-',
      '구입처': asset.purchaseSource || '-',
      '상각개월수': asset.depreciationMonths ? \`\${asset.depreciationMonths}개월\` : '-',
      '감가상각누계액': asset.accumulatedDepreciation ? \`\${asset.accumulatedDepreciation.toLocaleString()}원\` : '-',
      '잔존가치율': asset.residualValueRate ? \`\${asset.residualValueRate}%\` : '-',
      '장부가치': asset.bookValue ? \`\${asset.bookValue.toLocaleString()}원\` : '-',
      '기여액': asset.revenueContribution ? \`\${asset.revenueContribution.toLocaleString()}원\` : '-',
      '누적수리비': asset.totalRepairCost ? \`\${asset.totalRepairCost.toLocaleString()}원\` : '-',
      '임차처': asset.leaseVendorName || '-',
      '임차개시일': asset.leaseStartDate || '-',
      '임차만료일': asset.leaseEndDate || '-',
      '월임차료': asset.leaseMonthlyRent ? \`\${asset.leaseMonthlyRent.toLocaleString()}원\` : '-',
      '일임차료': asset.leaseDailyRent ? \`\${asset.leaseDailyRent.toLocaleString()}원\` : '-',
      '실제반납일': asset.actualReturnDate || '-',
      '매각일자': asset.saleDate || '-',
      '매각가격': asset.salePrice ? \`\${asset.salePrice.toLocaleString()}원\` : '-',
      '매각처': asset.saleDestination || '-',
      '정비점수': asset.maintenanceScore !== undefined ? \`\${asset.maintenanceScore}점\` : '-',
      '비고1': asset.memo1 || '-',
      '비고2': asset.memo2 || '-'
    }));`
  },
  'BankMatching.tsx': {
    target: "const excelData = filteredTransactions.map((t, idx) => {",
    replacement: `const excelData = filteredTransactions.map((t, idx) => {
      const infoParts = [];
      if (t.matchedBillingId) {
        if (t.matchedCustomerName) infoParts.push(t.matchedCustomerName);
        if (t.matchedSiteName) infoParts.push(t.matchedSiteName);
      }
      const remBal = getDepositBalance(t.id);
      const isFull = t.depositAmount > 0 && remBal <= 0;
      const isPartial = t.depositAmount > 0 && remBal > 0 && remBal < t.depositAmount;

      return {
        'No': idx + 1,
        '수납/지급 대사': isFull ? '수납완료' : isPartial ? '부분수납' : t.matchedBillingId ? '지급완료' : '미확인',
        '은행명': t.bankName || '미지정',
        '거래일시': t.transactionDate,
        '적요': t.summary || '-',
        '기재내용': t.counterparty || t.senderName || '-',
        '입금액 대비 수납결과': t.depositAmount > 0 ? \`입금 \${t.depositAmount.toLocaleString()}원 (잔여 \${remBal.toLocaleString()}원)\` : '-',
        '출금액 대비 정산결과': t.withdrawAmount > 0 ? \`출금 \${t.withdrawAmount.toLocaleString()}원\` : '-',
        '거래후 잔액': t.balance ? \`\${t.balance.toLocaleString()}원\` : '-',
        '취급/거래점': t.branchName || '-',
        '매칭 정보': infoParts.length > 0 ? infoParts.join(', ') : '-',
        '메모': t.memo || '-'
      };
    });`
  },
  'Customers.tsx': {
    target: "const excelData = filteredCustomers.map((c, idx) => ({",
    replacement: `const excelData = filteredCustomers.map((c, idx) => ({
      'No': idx + 1,
      '고객명': c.name,
      '대표자': c.ceoName || '-',
      '업태': c.businessType || '-',
      '종목': c.businessItem || '-',
      '대표 연락처': c.phone || '-',
      '대표 이메일': c.email || '-',
      '사업자등록번호': c.businessRegistrationNumber || '-',
      '본사 주소': c.address || '-',
      '영업 상태': c.salesStatus || '-',
      '사용 여부': c.isActive === false ? '비활성' : '활성'
    }));`
  },
  'Consumables.tsx': {
    target: "const excelData = filteredStats.map((stat, idx) => ({",
    replacement: `const excelData = filteredStats.map((stat, idx) => {
      const isEmergency = stat.totalStock < 10;
      return {
        'No': idx + 1,
        '자재 품목명': stat.itemName,
        '본사 중앙재고': stat.hqStock,
        '차량 이동재고': stat.truckStock,
        '전사 총재고': stat.totalStock,
        '단위': stat.unit || '개',
        '단가': \`\${(stat.unitPrice || 0).toLocaleString()}원\`,
        '본사 평가금액': \`\${((stat.hqStock || 0) * (stat.unitPrice || 0)).toLocaleString()}원\`,
        '최근 구입처': stat.lastVendorName || '-',
        '상태': isEmergency ? '재고긴급' : '적정'
      };
    });`
  }
};

async function run() {
  for (const [filename, { target, replacement }] of Object.entries(replacements)) {
    const p = path.join('src', 'pages', filename);
    if (!fs.existsSync(p)) continue;
    
    let content = fs.readFileSync(p, 'utf-8');
    
    const startIndex = content.indexOf(target);
    if (startIndex !== -1) {
      const blockRegex = new RegExp(target.replace(/[.*+?^$\{}()|[\\]\\\\]/g, '\\\\$&') + "[\\\\s\\\\S]*?\\}\\)\\s*;", 'g');
      let newContent = content.replace(blockRegex, replacement);
      
      const blockRegex2 = new RegExp(target.replace(/[.*+?^$\{}()|[\\]\\\\]/g, '\\\\$&') + "[\\\\s\\\\S]*?\\}\\);", 'g');
      newContent = newContent.replace(blockRegex2, replacement);
      
      fs.writeFileSync(p, newContent);
      console.log(\`Patched \${filename}\`);
    } else {
      console.log(\`Target not found in \${filename}\`);
    }
  }
}

run();
