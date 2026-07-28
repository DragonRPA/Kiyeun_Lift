const { createClient } = require('./node_modules/@supabase/supabase-js');

const SUPABASE_URL = 'https://yeunhmoicvckndjvhzfc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldW5obW9pY3Zja25kanZoemZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzMjU4NDEsImV4cCI6MjA1NTkwMTg0MX0.yD3z3XQn-V6Z5v2b6tH3z3XQn-V6Z5v2b6tH3z3XQn';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('🚀 Supabase 원격 DB deliveries_status_check 제약조건 원천 개편 시작...');

  const ddl = `
    ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_status_check";
    ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_status_check" CHECK (status IN ('PENDING', 'REQUESTED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'));
    NOTIFY pgrst, 'reload schema';
  `;

  try {
    const { data, error } = await supabase.rpc('dev_exec_ddl', { sql_query: ddl });
    if (error) {
      console.error('❌ DDL 실행 오류:', error);
    } else {
      console.log('🎉 [원천 개편 성공] deliveries_status_check 제약조건이 최신 6단계 규격으로 완전히 개편되었습니다!', data);
    }
  } catch (e) {
    console.error('❌ 예외 발생:', e);
  }
}

run();
