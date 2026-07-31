// d:\Kiyeun_Lift\src\services\email.ts
// 실 구글 연동 계정 (googleEmail + gmailAppPassword) 기반 real Gmail SMTP 발송 서비스

export interface SentEmail {
  id: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

class RealGmailService {
  private getEmails(): SentEmail[] {
    const val = localStorage.getItem('sent_emails');
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }

  private setEmails(data: SentEmail[]) {
    localStorage.setItem('sent_emails', JSON.stringify(data));
  }

  listSentEmails(): SentEmail[] {
    return this.getEmails();
  }

  /**
   * Gmail 연동 설정 계정 정보를 바탕으로 /api/send-email 호출을 통해 실제 수신인에게 전송
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    _attachmentIds: string[] = [],
    cc?: string
  ): Promise<SentEmail> {

    // 1. 등록된 GoogleConfig 정보 로드
    const configsVal = localStorage.getItem('erp_googleConfigs');
    const configs = configsVal ? JSON.parse(configsVal) : [];
    const config = configs[0];

    const googleEmail      = config?.googleEmail || '';
    const gmailAppPassword = config?.gmailAppPassword || '';

    if (!googleEmail || !gmailAppPassword) {
      throw new Error(
        '⚠️ 구글 연동 설정(구글 서비스 계정 이메일 및 Gmail 발송용 16자리 앱 비밀번호)이 시스템에 저장되어 있지 않습니다. [시스템 설정 > 구글 및 클라우드 연계 설정] 메뉴에서 구글 이메일 및 앱 비밀번호를 먼저 입력하고 저장해 주세요.'
      );
    }

    // 2. Vercel Serverless API (/api/send-email) 호출
    try {
      const resp = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          cc,
          subject,
          body,
          googleEmail,
          gmailAppPassword
        })
      });

      const result = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.error || 'Gmail 서버 메일 전송에 실패했습니다.');
      }

      // 3. 발송 성공 기록
      const newEmail: SentEmail = {
        id: `mail-${Math.random().toString(36).substr(2, 9)}`,
        to,
        cc,
        subject,
        body,
        sentAt: new Date().toISOString(),
        success: true
      };

      const history = this.getEmails();
      history.unshift(newEmail);
      this.setEmails(history);

      return newEmail;

    } catch (err: any) {
      console.error('Email sending error:', err);
      throw new Error(err?.message || '이메일 발송 도중 오류가 발생했습니다.');
    }
  }
}

export const emailService = new RealGmailService();
