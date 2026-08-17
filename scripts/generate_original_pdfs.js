// scripts/generate_original_pdfs.js
// public/documents/ 폴더에 원본 PDF 보관서류 (KCs인증서, PL보험증권, 사업자등록증, 통장사본 등) 생성 스크립트
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsDir = path.join(__dirname, '../public/documents');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

async function createPdfFile(filename, title, subtitle, items) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size (points)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();

  // Outer Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderWidth: 2,
    borderColor: rgb(0.1, 0.1, 0.1),
  });

  // Inner Double Border
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderWidth: 1,
    borderColor: rgb(0.3, 0.3, 0.3),
  });

  // Header Title
  page.drawText(title, {
    x: width / 2 - (title.length * 7),
    y: height - 80,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.5),
  });

  if (subtitle) {
    page.drawText(subtitle, {
      x: width / 2 - (subtitle.length * 4),
      y: height - 110,
      size: 11,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Divider
  page.drawLine({
    start: { x: 40, y: height - 130 },
    end: { x: width - 40, y: height - 130 },
    thickness: 1.5,
    color: rgb(0.1, 0.2, 0.5),
  });

  // Content Items
  let currentY = height - 170;
  for (const item of items) {
    page.drawText(item.label, {
      x: 50,
      y: currentY,
      size: 11,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(item.value, {
      x: 180,
      y: currentY,
      size: 11,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    currentY -= 30;
  }

  // Stamp / Seal Simulation Box
  page.drawRectangle({
    x: width - 160,
    y: 60,
    width: 110,
    height: 60,
    borderWidth: 1.5,
    borderColor: rgb(0.8, 0.1, 0.1),
    color: rgb(0.98, 0.93, 0.93),
  });

  page.drawText('OFFICIAL SEAL', {
    x: width - 150,
    y: 85,
    size: 10,
    font: fontBold,
    color: rgb(0.8, 0.1, 0.1),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(docsDir, filename), pdfBytes);
  console.log(`✅ Created original PDF document: ${filename}`);
}

async function main() {
  // 1. KCs 안전인증서 원본 PDF
  await createPdfFile('KCs_안전인증서_GTJZ0608ME.pdf', 'KCs SAFETY CERTIFICATE', 'Korean Industrial Safety Association (No. 2023-BA2300896002)', [
    { label: 'Manufacturer:', value: 'Hunan Sinoboom Intelligent Equipment Co., Ltd.' },
    { label: 'Model Name:', value: 'GTJZ0608ME (0.23 Ton)' },
    { label: 'Certificate No:', value: '23-BA4AH-50005' },
    { label: 'Issue Date:', value: '2023-06-20' },
    { label: 'Authority:', value: 'Korea Industrial Safety Association' },
    { label: 'Compliance:', value: 'Industrial Safety & Health Act Article 84' }
  ]);

  // 2. 당해 PL보험증권 (2026-2027) 원본 PDF
  await createPdfFile('PL보험증권_2026_2027.pdf', 'PRODUCT LIABILITY INSURANCE POLICY (2026-2027)', 'Hyundai Marine & Fire Insurance Co., Ltd. (Policy No. 202602-033)', [
    { label: 'Insured Name:', value: '(Ju) Kiyeon Lift (138-81-83251)' },
    { label: 'Coverage Period:', value: '2026-03-05 ~ 2027-03-05' },
    { label: 'Limit of Liability:', value: 'KRW 500,000,000 per claim / total' },
    { label: 'Coverage Scope:', value: 'Domestic Product Liability Coverage' },
    { label: 'Underwriter:', value: 'Korea Chamber of Commerce & Industry / Hyundai Marine' }
  ]);

  // 3. 차기/갱신 PL보험증권 (2027-2028) 원본 PDF
  await createPdfFile('PL보험증권_2027_2028.pdf', 'PRODUCT LIABILITY INSURANCE POLICY (2027-2028 RENEWAL)', 'Hyundai Marine & Fire Insurance Co., Ltd. (Renewal Policy No. 202702-099)', [
    { label: 'Insured Name:', value: '(Ju) Kiyeon Lift (138-81-83251)' },
    { label: 'Coverage Period:', value: '2027-03-05 ~ 2028-03-05' },
    { label: 'Limit of Liability:', value: 'KRW 500,000,000 per claim / total' },
    { label: 'Coverage Note:', value: 'Auto-Renewal Continuity Attachment for Long-term Contracts' },
    { label: 'Underwriter:', value: 'Korea Chamber of Commerce & Industry / Hyundai Marine' }
  ]);

  // 4. 사업자등록증 원본 PDF
  await createPdfFile('사업자등록증_기연리프트.pdf', 'BUSINESS REGISTRATION CERTIFICATE', 'National Tax Service / Yongin Tax Office (Reg No. 138-81-83251)', [
    { label: 'Company Name:', value: 'Kiyeon Lift Co., Ltd.' },
    { label: 'Representative:', value: 'Lee Su Yong' },
    { label: 'Registration No:', value: '138-81-83251' },
    { label: 'Establishment Date:', value: '2013-04-03' },
    { label: 'Business Address:', value: '21-3 Galdam-ro 112beon-gil, Mohyeon-eup, Cheoin-gu, Yongin-si' },
    { label: 'Business Type:', value: 'Business Support & Rental Services / Aerial Lift Rental' }
  ]);

  // 5. 통장사본 원본 PDF
  await createPdfFile('통장사본_신한은행.pdf', 'BANKBOOK COVER COPY', 'Shinhan Bank Corporate Account Verification', [
    { label: 'Bank Name:', value: 'Shinhan Bank' },
    { label: 'Account Holder:', value: 'Kiyeon Lift Co., Ltd.' },
    { label: 'Account Number:', value: '140-010-007060' },
    { label: 'Account Product:', value: 'Corporate Free Deposit Account' },
    { label: 'Branch:', value: 'Giheung ICT Valley Branch (5453)' }
  ]);

  // 6. 장비작동법 매뉴얼 원본 PDF
  await createPdfFile('장비작동법_SINOBOOM.pdf', 'EQUIPMENT OPERATING MANUAL', 'SINOBOOM Scissor Lift GTJZ0608ME Operating Guide', [
    { label: 'Equipment Model:', value: 'GTJZ0608ME' },
    { label: 'Pre-check Points:', value: 'Over-ascent bar, Emergency Stop Button, Safety Harness, Helmet' },
    { label: 'Lower Control:', value: 'Emergency Switch Pull -> Key Left -> Press Button & Operate Lever' },
    { label: 'Upper Control:', value: 'Key Right -> Upper Emergency Switch -> Step Footswitch & Operate Joystick' }
  ]);

  // 7. 비상하강작동법 매뉴얼 원본 PDF
  await createPdfFile('비상하강작동법_SINOBOOM.pdf', 'EMERGENCY LOWERING INSTRUCTIONS', 'SINOBOOM Emergency Lowering Valve Operation', [
    { label: 'Equipment Model:', value: 'SINOBOOM All Scissors Series' },
    { label: 'Emergency Procedure:', value: 'Pull the red emergency lowering handle located at the rear bottom of the machine' },
    { label: 'Safety Note:', value: 'Keep clear of platform area while emergency lowering is in progress' }
  ]);
}

main().catch(console.error);
