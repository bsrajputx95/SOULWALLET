-- Citus Sharding Preparation Script
-- 
-- Description: Preparation script for horizontal scaling with Citus.
-- This script documents the sharding strategy and provides SQL commands
-- to convert to a distributed database when scaling becomes necessary.
--
-- Current Status: PREPARATION ONLY - Do not run in production without planning
--
-- Author: SoulWallet Development Team
-- Version: 1.0.0

-- ============================================
-- SHARDING STRATEGY DOCUMENTATION
-- ============================================
--
-- Shard Key Selection: userId
-- Rationale: Most queries filter by user, enabling co-located joins
--
-- Table Classification:
-- - DISTRIBUTED: Tables sharded by userId (high volume, user-specific)
-- - REFERENCE: Tables replicated to all nodes (small, frequently joined)
-- - LOCAL: Tables kept on coordinator (admin-only, low volume)
--
-- Distributed Tables (shard by userId):
--   - users (shard by id)
--   - sessions
--   - transactions
--   - contacts
--   - notifications
--   - portfolio_snapshots
--   - session_activities
--   - copy_trading
--   - positions
--   - posts
--   - post_likes
--   - post_comments
--   - financial_audit_logs
--   - data_deletion_requests
--   - data_export_requests
--
-- Reference Tables (replicated):
--   - token_prices (small, frequently needed)
--   - trader_profiles (small, joined with copy_trading)
--   - key_versions (small, system-wide)
--   - jwt_secret_versions (small, system-wide)
--
-- Local Tables (coordinator only):
--   - regulatory_reports (admin only)
--   - aml_alerts (compliance team only)

-- ============================================
-- PRE-MIGRATION CHECKLIST
-- ============================================
-- Before running this script:
-- 1. Backup all databases
-- 2. Set up Citus cluster with coordinator and workers
-- 3. Test on staging environment
-- 4. Plan maintenance window (expect 1-4 hours downtime)
-- 5. Update connection strings to point to coordinator
-- 6. Verify all application queries work with distributed tables

-- ============================================
-- CITUS EXTENSION ACTIVATION
-- ============================================
-- Run on coordinator node only

/*
-- Enable Citus extension
CREATE EXTENSION IF NOT EXISTS citus;

-- Add worker nodes (replace with actual worker hostnames)
-- SELECT master_add_node('worker-1', 5432);
-- SELECT master_add_node('worker-2', 5432);
*/

-- ============================================
-- REFERENCE TABLES (run first)
-- ============================================
-- Reference tables are replicated to all worker nodes

/*
-- Token prices: small, frequently joined
SELECT create_reference_table('token_prices');

-- Trader profiles: frequently joined with copy_trading
SELECT create_reference_table('trader_profiles');

-- Key management: system-wide, small
SELECT create_reference_table('key_versions');
SELECT create_reference_table('jwt_secret_versions');
*/

-- ============================================
-- DISTRIBUTED TABLES
-- ============================================
-- Distributed tables are sharded by the specified column

/*
-- Users: shard by id (primary shard key)
SELECT create_distributed_table('users', 'id');

-- User-related tables: shard by userId for co-location
SELECT create_distributed_table('sessions', 'userId', colocate_with => 'users');
SELECT create_distributed_table('transactions', 'userId', colocate_with => 'users');
SELECT create_distributed_table('contacts', 'userId', colocate_with => 'users');
SELECT create_distributed_table('notifications', 'userId', colocate_with => 'users');
SELECT create_distributed_table('portfolio_snapshots', 'userId', colocate_with => 'users');
SELECT create_distributed_table('session_activities', 'userId', colocate_with => 'users');
SELECT create_distributed_table('user_settings', 'userId', colocate_with => 'users');
SELECT create_distributed_table('push_tokens', 'userId', colocate_with => 'users');
SELECT create_distributed_table('api_keys', 'userId', colocate_with => 'users');
SELECT create_distributed_table('devices', 'userId', colocate_with => 'users');
SELECT create_distributed_table('custodial_wallets', 'userId', colocate_with => 'users');

-- Social features: shard by userId
SELECT create_distributed_table('posts', 'userId', colocate_with => 'users');
SELECT create_distributed_table('post_likes', 'userId', colocate_with => 'users');
SELECT create_distributed_table('post_comments', 'userId', colocate_with => 'users');
SELECT create_distributed_table('post_votes', 'userId', colocate_with => 'users');
SELECT create_distributed_table('reposts', 'userId', colocate_with => 'users');
SELECT create_distributed_table('follows', 'followerId', colocate_with => 'users');
SELECT create_distributed_table('vip_subscriptions', 'subscriberId', colocate_with => 'users');
SELECT create_distributed_table('ibuy_settings', 'userId', colocate_with => 'users');
SELECT create_distributed_table('ibuy_purchases', 'userId', colocate_with => 'users');

-- Copy trading: shard by userId
SELECT create_distributed_table('copy_trading', 'userId', colocate_with => 'users');
-- Note: positions needs special handling as it references copy_trading
-- SELECT create_distributed_table('positions', 'copyTradingId');

-- Compliance: shard by userId
SELECT create_distributed_table('financial_audit_logs', 'userId', colocate_with => 'users');
SELECT create_distributed_table('data_deletion_requests', 'userId', colocate_with => 'users');
SELECT create_distributed_table('data_export_requests', 'userId', colocate_with => 'users');
SELECT create_distributed_table('consent_logs', 'userId', colocate_with => 'users');
SELECT create_distributed_table('kyc_verifications', 'userId', colocate_with => 'users');
SELECT create_distributed_table('authorization_audits', 'userId', colocate_with => 'users');
SELECT create_distributed_table('dead_letter_queue', 'userId', colocate_with => 'users');
*/

-- ============================================
-- POST-MIGRATION VERIFICATION
-- ============================================

/*
-- Check shard distribution
SELECT logicalrelid, count(*) as shard_count
FROM pg_dist_shard
GROUP BY logicalrelid
ORDER BY logicalrelid;

-- Check reference tables
SELECT logicalrelid, repmodel
FROM pg_dist_partition
WHERE repmodel = 't';

-- Check distributed tables
SELECT logicalrelid, partmethod, repmodel
FROM pg_dist_partition
WHERE partmethod = 'h';

-- Verify data distribution
SELECT * FROM citus_shards;

-- Check worker node status
SELECT * FROM citus_get_active_worker_nodes();
*/

-- ============================================
-- QUERY PERFORMANCE NOTES
-- ============================================
--
-- After enabling Citus, be aware of:
--
-- 1. Co-located Joins: Queries joining tables with same shard key are efficient
--    Example: SELECT * FROM users u JOIN sessions s ON u.id = s.userId
--
-- 2. Cross-shard Joins: Avoid when possible, very expensive
--    Example: SELECT * FROM users u1, users u2 WHERE u1.email = u2.email
--
-- 3. Reference Table Joins: Efficient, as reference tables exist on all nodes
--    Example: SELECT * FROM copy_trading ct JOIN trader_profiles tp ON ct.traderId = tp.id
--
-- 4. Aggregations: Use subqueries to push down aggregations
--    SELECT user_id, count(*) FROM (
--      SELECT userId as user_id, id FROM transactions
--    ) sub GROUP BY user_id;

-- ============================================
-- ROLLBACK PROCEDURE (EMERGENCY)
-- ============================================
/*
-- To undo distribution (WARNING: Data loss if workers are down!)
-- SELECT undistribute_table('table_name');

-- Or restore from backup
*/

-- End of preparation script
