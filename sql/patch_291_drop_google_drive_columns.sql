-- Build.291: 구글 드라이브 관련 컬럼 제거 DDL 패치
-- 2026-08-30 11:24
-- CF R2 중심 설계로 전환 후 불필요해진 Google Drive / Apps Script / OAuth 컬럼 삭제

ALTER TABLE google_configs DROP COLUMN IF EXISTS quotation_template_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS contract_template_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS safety_inspection_template_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS pre_delivery_checklist_template_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS biz_reg_cert_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS bankbook_copy_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS transaction_statement_template_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS default_root_folder_id;
ALTER TABLE google_configs DROP COLUMN IF EXISTS apps_script_url;
ALTER TABLE google_configs DROP COLUMN IF EXISTS oauth_client_id;
