create index if not exists animal_photos_uploader_idx on public.animal_photos (uploader_id);
create index if not exists animal_status_history_animal_idx on public.animal_status_history (animal_id, changed_at desc);
create index if not exists animal_status_history_changed_by_idx on public.animal_status_history (changed_by);
create index if not exists listing_reports_reporter_idx on public.listing_reports (reporter_id);
