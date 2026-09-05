// src/services/visionOcrService.ts
// 법인차량 계기판 및 주유영수증 Vision AI 자동인식 클라이언트 서비스

export interface OdometerAnalysisResult {
  success: boolean;
  mileage?: number;
  confidence?: number;
  rawText?: string;
  error?: string;
}

export interface FuelReceiptAnalysisResult {
  success: boolean;
  fuelDate?: string;
  gasStationName?: string;
  fuelType?: '경유' | '휘발유' | 'LPG' | '전기';
  fuelVolume?: number;
  fuelAmount?: number;
  unitPrice?: number;
  paymentMethod?: 'CORPORATE_CARD' | 'PERSONAL_EXPENSE';
  cardLast4?: string;
  confidence?: number;
  error?: string;
}

/**
 * 1. 자동차 계기판 사진 분석
 */
export async function analyzeOdometerPhoto(
  imageBase64: string,
  vehicleContext?: { vehicleNo?: string; modelName?: string; currentMileage?: number }
): Promise<OdometerAnalysisResult> {
  try {
    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'ODOMETER',
        imageBase64,
        vehicleContext
      })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '인식 실패' };
    }

    const data = json.data;
    const mileageNum = typeof data.mileage === 'number' ? data.mileage : parseInt(String(data.mileage).replace(/[^0-9]/g, ''), 10);

    if (isNaN(mileageNum) || mileageNum <= 0) {
      return { success: false, error: '유효한 주행거리를 인식하지 못했습니다.' };
    }

    return {
      success: true,
      mileage: mileageNum,
      confidence: data.confidence || 0.9,
      rawText: data.rawText
    };
  } catch (err: any) {
    console.warn('[VisionOcrService] analyzeOdometerPhoto exception:', err);
    return { success: false, error: err?.message || '네트워크 오류' };
  }
}

/**
 * 2. 주유 영수증 사진 분석
 */
export async function analyzeFuelReceiptPhoto(
  imageBase64: string,
  vehicleContext?: { vehicleNo?: string; fuelType?: string }
): Promise<FuelReceiptAnalysisResult> {
  try {
    const res = await fetch('/api/vision-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'FUEL_RECEIPT',
        imageBase64,
        vehicleContext
      })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return { success: false, error: json.error || '영수증 인식 실패' };
    }

    const data = json.data;

    // 숫자 데이터 정제
    const fuelVolume = typeof data.fuelVolume === 'number'
      ? data.fuelVolume
      : parseFloat(String(data.fuelVolume || '').replace(/[^0-9.]/g, '')) || undefined;

    const fuelAmount = typeof data.fuelAmount === 'number'
      ? data.fuelAmount
      : parseInt(String(data.fuelAmount || '').replace(/[^0-9]/g, ''), 10) || undefined;

    const unitPrice = typeof data.unitPrice === 'number'
      ? data.unitPrice
      : parseInt(String(data.unitPrice || '').replace(/[^0-9]/g, ''), 10) || undefined;

    return {
      success: true,
      fuelDate: data.fuelDate || undefined,
      gasStationName: data.gasStationName || undefined,
      fuelType: data.fuelType || undefined,
      fuelVolume,
      fuelAmount,
      unitPrice,
      paymentMethod: data.paymentMethod === 'PERSONAL_EXPENSE' ? 'PERSONAL_EXPENSE' : 'CORPORATE_CARD',
      cardLast4: data.cardLast4 || undefined,
      confidence: data.confidence || 0.9
    };
  } catch (err: any) {
    console.warn('[VisionOcrService] analyzeFuelReceiptPhoto exception:', err);
    return { success: false, error: err?.message || '네트워크 오류' };
  }
}
