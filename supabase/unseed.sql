-- CREAM — remove the demo dataset
--
-- Generated alongside supabase/seed.sql. Reverses it exactly: the same tables,
-- deleted in reverse dependency order.
--
--   45 tables. 2026-10-11T03:12:39.411Z
--
-- WARNING — this removes every row in these tables, including briefs and
-- accounts created through the UI while the demo data was loaded. The schema
-- has no dataset discriminator, so seed rows and real rows are not yet
-- distinguishable. See P1-2 in reference/floating-tasks.md.
--
-- On a demo project this is the expected way to switch the site back to an
-- empty state. On a project holding real work, do not run it.

begin;

delete from public.shortlists cascade;
delete from public.reviews cascade;
delete from public.provenance_records cascade;
delete from public.escrows cascade;
delete from public.generation_samples cascade;
delete from public.generation_rounds cascade;
delete from public.engagements cascade;
delete from public.contract_signatures cascade;
delete from public.contract_clauses cascade;
delete from public.contracts cascade;
delete from public.offer_milestones cascade;
delete from public.offers cascade;
delete from public.commercial_use cascade;
delete from public.brief_deliverables cascade;
delete from public.briefs cascade;
delete from public.conversation_turns cascade;
delete from public.brief_sessions cascade;
delete from public.portfolio_piece_skills cascade;
delete from public.portfolio_piece_models cascade;
delete from public.portfolio_piece_tools cascade;
delete from public.portfolio_pieces cascade;
delete from public.workflow_stages cascade;
delete from public.workflows cascade;
delete from public.identity_verifications cascade;
delete from public.creator_workflows cascade;
delete from public.creator_models cascade;
delete from public.creator_skills cascade;
delete from public.creator_tools cascade;
delete from public.creator_aspect_ratios cascade;
delete from public.creator_content_types cascade;
delete from public.creator_specializations cascade;
delete from public.creator_languages cascade;
delete from public.creator_stats cascade;
delete from public.creators cascade;
delete from public.brand_preferred_formats cascade;
delete from public.brands cascade;
delete from public.regions cascade;
delete from public.channels cascade;
delete from public.industries cascade;
delete from public.specializations cascade;
delete from public.aspect_ratios cascade;
delete from public.content_types cascade;
delete from public.skills cascade;
delete from public.models cascade;
delete from public.tools cascade;
commit;
