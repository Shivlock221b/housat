alter table rental_tickets
add column if not exists property_types text[] default '{}';
