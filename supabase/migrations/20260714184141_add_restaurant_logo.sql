alter table public.restaurants
add column if not exists logo_url text,
add column if not exists logo_visible boolean not null default true;

comment on column public.restaurants.logo_url is 'Public URL of the restaurant logo stored in menu-assets.';
comment on column public.restaurants.logo_visible is 'Controls whether the restaurant logo is rendered on the menu cover.';

grant select (logo_url, logo_visible) on public.restaurants to anon;
grant insert (logo_url, logo_visible) on public.restaurants to authenticated;
grant update (logo_url, logo_visible) on public.restaurants to authenticated;
