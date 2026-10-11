-- CREAM — remove the demo dataset
--
-- Generated alongside supabase/seed.sql. Reverses it exactly, by row.
--
--   36 tables. 2026-10-11T05:23:22.112Z
--
-- SCOPED. Every delete names the specific seed rows, so accounts, briefs and
-- offers created through the UI are left untouched. Only rows whose identifier
-- was written by seed.sql are removed, plus whatever cascades from them.
--
-- Identifiers are recognisable because handle_new_user() appends six hex
-- characters of the user's own uuid to their handle (cr-tihens7-a3f9c1),
-- where every seed slug is clean (cr-aarav).
--
-- Taxonomy tables (tools, models, skills, aspect ratios, and so on) are NOT
-- removed. They are shared vocabulary: a real creator's portfolio references
-- them by id, so deleting them would break real rows. They are left in place
-- and the application never renders them directly.
--
begin;

delete from public.shortlists where brand_id in (
  select p.id from public.brands p where p.id in ('bd-nirvani', 'bd-vayu', 'bd-halcyon', 'bd-meridian')
) cascade;

delete from public.reviews where slug in ('rv-1', 'rv-2', 'rv-3', 'rv-4', 'rv-5', 'rv-6', 'rv-7', 'rv-8', 'rv-9', 'rv-10', 'rv-11', 'rv-12', 'rv-13', 'rv-14', 'rv-15', 'rv-16') cascade;

delete from public.provenance_records where slug in ('pv-monsoon-r1') cascade;

delete from public.escrows where slug in ('es-monsoon') cascade;

delete from public.generation_samples where round_id in (
  select p.id from public.generation_rounds p where p.slug in ('gn-monsoon-0', 'gn-monsoon-1', 'gn-undertone-1')
) cascade;

delete from public.generation_rounds where slug in ('gn-monsoon-0', 'gn-monsoon-1', 'gn-undertone-1') cascade;

delete from public.engagements where slug in ('en-aarav-1', 'en-rohan-1') cascade;

delete from public.contract_signatures where contract_id in (
  select p.id from public.contracts p where p.slug in ('ct-monsoon-start', 'ct-monsoon-nda')
) cascade;

delete from public.contract_clauses where slug in ('c-parties', 'c-watermark', 'c-scope', 'c-reject', 'c-rights', 'c-escrow', 'c-nda') cascade;

delete from public.contracts where slug in ('ct-monsoon-start', 'ct-monsoon-nda') cascade;

delete from public.offer_milestones where offer_id in (
  select p.id from public.offers p where p.slug in ('of-aarav-monsoon', 'of-diya-monsoon')
) cascade;

delete from public.offers where slug in ('of-aarav-monsoon', 'of-diya-monsoon') cascade;

delete from public.commercial_use where brief_id in (
  select p.id from public.briefs p where p.slug in ('br-monsoon', 'br-ignition', 'br-undertone')
) cascade;

delete from public.brief_deliverables where brief_id in (
  select p.id from public.briefs p where p.slug in ('br-monsoon', 'br-ignition', 'br-undertone')
) cascade;

delete from public.briefs where slug in ('br-monsoon', 'br-ignition', 'br-undertone') cascade;

delete from public.conversation_turns where slug in ('t1', 't2', 't3', 't4', 't5', 't6', 't7') cascade;

delete from public.brief_sessions where slug in ('bs-monsoon', 'bs-ignition', 'bs-undertone') cascade;

delete from public.portfolio_piece_skills where portfolio_piece_id in (
  select p.id from public.portfolio_pieces p where p.id in ('pf-aarav-1', 'pf-aarav-2', 'pf-aarav-3', 'pf-aarav-4', 'pf-ishita-1', 'pf-ishita-2', 'pf-ishita-3', 'pf-ishita-4', 'pf-ishita-5', 'pf-kabir-1', 'pf-kabir-2', 'pf-kabir-3', 'pf-tara-1', 'pf-tara-2', 'pf-tara-3', 'pf-tara-4', 'pf-rehan-1', 'pf-rehan-2', 'pf-rehan-3', 'pf-diya-1', 'pf-diya-2', 'pf-diya-3', 'pf-diya-4', 'pf-nikhil-1', 'pf-nikhil-2', 'pf-nikhil-3', 'pf-ananya-1', 'pf-ananya-2', 'pf-ananya-3', 'pf-rohan-1', 'pf-rohan-2', 'pf-rohan-3', 'pf-rohan-4', 'pf-meera-1', 'pf-meera-2', 'pf-meera-3', 'pf-yuki-1', 'pf-yuki-2', 'pf-yuki-3', 'pf-samar-1', 'pf-samar-2', 'pf-samar-3', 'pf-vikram-1', 'pf-vikram-2', 'pf-vikram-3', 'pf-priya-1', 'pf-priya-2', 'pf-priya-3')
) cascade;

delete from public.portfolio_piece_models where portfolio_piece_id in (
  select p.id from public.portfolio_pieces p where p.id in ('pf-aarav-1', 'pf-aarav-2', 'pf-aarav-3', 'pf-aarav-4', 'pf-ishita-1', 'pf-ishita-2', 'pf-ishita-3', 'pf-ishita-4', 'pf-ishita-5', 'pf-kabir-1', 'pf-kabir-2', 'pf-kabir-3', 'pf-tara-1', 'pf-tara-2', 'pf-tara-3', 'pf-tara-4', 'pf-rehan-1', 'pf-rehan-2', 'pf-rehan-3', 'pf-diya-1', 'pf-diya-2', 'pf-diya-3', 'pf-diya-4', 'pf-nikhil-1', 'pf-nikhil-2', 'pf-nikhil-3', 'pf-ananya-1', 'pf-ananya-2', 'pf-ananya-3', 'pf-rohan-1', 'pf-rohan-2', 'pf-rohan-3', 'pf-rohan-4', 'pf-meera-1', 'pf-meera-2', 'pf-meera-3', 'pf-yuki-1', 'pf-yuki-2', 'pf-yuki-3', 'pf-samar-1', 'pf-samar-2', 'pf-samar-3', 'pf-vikram-1', 'pf-vikram-2', 'pf-vikram-3', 'pf-priya-1', 'pf-priya-2', 'pf-priya-3')
) cascade;

delete from public.portfolio_piece_tools where portfolio_piece_id in (
  select p.id from public.portfolio_pieces p where p.id in ('pf-aarav-1', 'pf-aarav-2', 'pf-aarav-3', 'pf-aarav-4', 'pf-ishita-1', 'pf-ishita-2', 'pf-ishita-3', 'pf-ishita-4', 'pf-ishita-5', 'pf-kabir-1', 'pf-kabir-2', 'pf-kabir-3', 'pf-tara-1', 'pf-tara-2', 'pf-tara-3', 'pf-tara-4', 'pf-rehan-1', 'pf-rehan-2', 'pf-rehan-3', 'pf-diya-1', 'pf-diya-2', 'pf-diya-3', 'pf-diya-4', 'pf-nikhil-1', 'pf-nikhil-2', 'pf-nikhil-3', 'pf-ananya-1', 'pf-ananya-2', 'pf-ananya-3', 'pf-rohan-1', 'pf-rohan-2', 'pf-rohan-3', 'pf-rohan-4', 'pf-meera-1', 'pf-meera-2', 'pf-meera-3', 'pf-yuki-1', 'pf-yuki-2', 'pf-yuki-3', 'pf-samar-1', 'pf-samar-2', 'pf-samar-3', 'pf-vikram-1', 'pf-vikram-2', 'pf-vikram-3', 'pf-priya-1', 'pf-priya-2', 'pf-priya-3')
) cascade;

delete from public.portfolio_pieces where id in ('pf-aarav-1', 'pf-aarav-2', 'pf-aarav-3', 'pf-aarav-4', 'pf-ishita-1', 'pf-ishita-2', 'pf-ishita-3', 'pf-ishita-4', 'pf-ishita-5', 'pf-kabir-1', 'pf-kabir-2', 'pf-kabir-3', 'pf-tara-1', 'pf-tara-2', 'pf-tara-3', 'pf-tara-4', 'pf-rehan-1', 'pf-rehan-2', 'pf-rehan-3', 'pf-diya-1', 'pf-diya-2', 'pf-diya-3', 'pf-diya-4', 'pf-nikhil-1', 'pf-nikhil-2', 'pf-nikhil-3', 'pf-ananya-1', 'pf-ananya-2', 'pf-ananya-3', 'pf-rohan-1', 'pf-rohan-2', 'pf-rohan-3', 'pf-rohan-4', 'pf-meera-1', 'pf-meera-2', 'pf-meera-3', 'pf-yuki-1', 'pf-yuki-2', 'pf-yuki-3', 'pf-samar-1', 'pf-samar-2', 'pf-samar-3', 'pf-vikram-1', 'pf-vikram-2', 'pf-vikram-3', 'pf-priya-1', 'pf-priya-2', 'pf-priya-3') cascade;

delete from public.workflow_stages where slug in ('s1', 's2', 's3', 's4', 's5') cascade;

delete from public.workflows where id in ('wf-cinematic-previs', 'wf-photoreal-set', 'wf-product-render', 'wf-motion-system', 'wf-character-bible', 'wf-audio-stack', 'wf-fabric-realism', 'wf-previs-game', 'wf-performance-creative', 'wf-luxury-campaign', 'wf-sound-design-gen', 'wf-wellness-editorial') cascade;

delete from public.identity_verifications where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_workflows where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_models where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_skills where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_tools where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_aspect_ratios where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_content_types where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_specializations where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_languages where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creator_stats where creator_id in (
  select p.id from public.creators p where p.id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya')
) cascade;

delete from public.creators where id in ('cr-aarav', 'cr-ishita', 'cr-kabir', 'cr-tara', 'cr-rehan', 'cr-diya', 'cr-nikhil', 'cr-ananya', 'cr-rohan', 'cr-meera', 'cr-yuki', 'cr-samar', 'cr-vikram', 'cr-priya') cascade;

delete from public.brand_preferred_formats where brand_id in (
  select p.id from public.brands p where p.id in ('bd-nirvani', 'bd-vayu', 'bd-halcyon', 'bd-meridian')
) cascade;

delete from public.brands where id in ('bd-nirvani', 'bd-vayu', 'bd-halcyon', 'bd-meridian') cascade;

commit;
