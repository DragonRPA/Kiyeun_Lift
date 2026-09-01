
-- ==========================================
-- 43. 마이그레이션 대사 리포트 (reconciliation_reports)
-- ==========================================
CREATE TABLE IF NOT EXISTS reconciliation_reports (
    id TEXT PRIMARY KEY,
    migration_run_at TEXT NOT NULL,
    asset_count_excel INT,
    asset_count_db INT,
    asset_count_match BOOLEAN,
    billing_total_excel DOUBLE PRECISION,
    billing_total_db DOUBLE PRECISION,
    billing_total_diff DOUBLE PRECISION,
    billing_total_match BOOLEAN,
    details_header_sum DOUBLE PRECISION,
    details_detail_sum DOUBLE PRECISION,
    details_sum_diff DOUBLE PRECISION,
    details_sum_match BOOLEAN,
    lease_total_excel DOUBLE PRECISION,
    lease_total_db DOUBLE PRECISION,
    lease_total_match BOOLEAN,
    lifecycle_contracts INT,
    lifecycle_deliveries INT,
    lifecycle_match BOOLEAN,
    orphan_contracts INT,
    orphan_assets INT,
    orphan_is_clean BOOLEAN,
    all_passed BOOLEAN,
    memo TEXT,
    created_at TEXT NOT NULL
);
