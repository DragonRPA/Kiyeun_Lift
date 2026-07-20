// d:\Kiyeun_Lift\src\services\email.ts
import { drive, DriveFile } from './drive';

export interface SentEmail {
  id: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachments: DriveFile[];
  sentAt: string;
}

class MockEmailService {
  private getEmails(): SentEmail[] {
    const val = localStorage.getItem('sent_emails');
    if (!val) return [];
    return JSON.parse(val);
  }

  private setEmails(data: SentEmail[]) {
    localStorage.setItem('sent_emails', JSON.stringify(data));
  }

  listSentEmails(): SentEmail[] {
    return this.getEmails();
  }

  sendEmail(to: string, subject: string, body: string, attachmentIds: string[], cc?: string): Promise<SentEmail> {
    return new Promise((resolve) => {
      // 1.5초 시뮬레이션 지연 (네트워크 지연 모방)
      setTimeout(() => {
        const allFiles = drive.listAllFiles();
        const attachments = allFiles.filter(f => attachmentIds.includes(f.id));

        // 개발모드 강제 리디렉션 확인
        const configsVal = localStorage.getItem('erp_googleConfigs');
        const configs = configsVal ? JSON.parse(configsVal) : [];
        const isDev = configs[0]?.isDevMode !== false;

        const finalTo = isDev ? '77.victor.lee@gmail.com' : to;
        const finalCc = isDev ? undefined : cc;

        const newEmail: SentEmail = {
          id: `mail-${Math.random().toString(36).substr(2, 9)}`,
          to: finalTo,
          cc: finalCc,
          subject: isDev ? `[DEV-우회] ${subject}` : subject,
          body: isDev ? `[★개발모드 우회 메일★ 원래 수신처: ${to}${cc ? `, 참조: ${cc}` : ''}]\n\n${body}` : body,
          attachments,
          sentAt: new Date().toISOString()
        };

        const emails = this.getEmails();
        emails.unshift(newEmail); // 최신 보낸메일 우선
        this.setEmails(emails);

        console.log(`[Email Sent] To: ${to}, Subject: ${subject}, Attachments: ${attachments.map(a => a.name).join(', ')}`);
        resolve(newEmail);
      }, 1500);
    });
  }
}

export const emailService = new MockEmailService();
