begin;

create table if not exists public.restaurants (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name text not null check (char_length(name) between 1 and 120),
    slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    description text not null default '',
    phone text not null default '',
    wifi_ssid text not null default '',
    wifi_password text not null default '',
    cover_url text,
    menu_type text not null default 'digital' check (menu_type in ('digital', 'pdf')),
    pdf_url text,
    font text not null default 'Outfit',
    color_primary text not null default '#0cc0df' check (color_primary ~ '^#[0-9A-Fa-f]{6}$'),
    color_text text not null default '#1a1a1a' check (color_text ~ '^#[0-9A-Fa-f]{6}$'),
    color_text_secondary text not null default '#666666' check (color_text_secondary ~ '^#[0-9A-Fa-f]{6}$'),
    color_background text not null default '#ffffff' check (color_background ~ '^#[0-9A-Fa-f]{6}$'),
    category_order jsonb not null default '["Menu"]'::jsonb check (jsonb_typeof(category_order) = 'array'),
    category_images jsonb not null default '{}'::jsonb check (jsonb_typeof(category_images) = 'object'),
    subscription_plan text not null default 'free' check (subscription_plan in ('free', 'pro')),
    subscription_status text not null default 'free',
    stripe_customer_id text,
    trial_ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint restaurants_owner_id_key unique (owner_id)
);

create unique index if not exists restaurants_stripe_customer_id_key
    on public.restaurants (stripe_customer_id)
    where stripe_customer_id is not null;

create table if not exists public.menu_items (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references public.restaurants (id) on delete cascade,
    name text not null check (char_length(name) between 1 and 160),
    description text not null default '',
    category text not null check (char_length(category) between 1 and 120),
    price numeric(10, 2) not null default 0 check (price >= 0),
    available boolean not null default true,
    image_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists menu_items_restaurant_category_idx
    on public.menu_items (restaurant_id, category);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;

drop policy if exists restaurants_public_read on public.restaurants;
create policy restaurants_public_read
on public.restaurants for select to anon
using (true);

drop policy if exists restaurants_owner_read on public.restaurants;
create policy restaurants_owner_read
on public.restaurants for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists restaurants_owner_insert on public.restaurants;
create policy restaurants_owner_insert
on public.restaurants for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists restaurants_owner_update on public.restaurants;
create policy restaurants_owner_update
on public.restaurants for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists restaurants_owner_delete on public.restaurants;
create policy restaurants_owner_delete
on public.restaurants for delete to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read
on public.menu_items for select to anon
using (true);

drop policy if exists menu_items_owner_read on public.menu_items;
create policy menu_items_owner_read
on public.menu_items for select to authenticated
using (
    exists (
        select 1 from public.restaurants
        where restaurants.id = menu_items.restaurant_id
          and restaurants.owner_id = (select auth.uid())
    )
);

drop policy if exists menu_items_owner_insert on public.menu_items;
create policy menu_items_owner_insert
on public.menu_items for insert to authenticated
with check (
    exists (
        select 1 from public.restaurants
        where restaurants.id = menu_items.restaurant_id
          and restaurants.owner_id = (select auth.uid())
    )
);

drop policy if exists menu_items_owner_update on public.menu_items;
create policy menu_items_owner_update
on public.menu_items for update to authenticated
using (
    exists (
        select 1 from public.restaurants
        where restaurants.id = menu_items.restaurant_id
          and restaurants.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1 from public.restaurants
        where restaurants.id = menu_items.restaurant_id
          and restaurants.owner_id = (select auth.uid())
    )
);

drop policy if exists menu_items_owner_delete on public.menu_items;
create policy menu_items_owner_delete
on public.menu_items for delete to authenticated
using (
    exists (
        select 1 from public.restaurants
        where restaurants.id = menu_items.restaurant_id
          and restaurants.owner_id = (select auth.uid())
    )
);

revoke all on table public.restaurants from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select (
    id, name, slug, description, phone, wifi_ssid, wifi_password, cover_url,
    menu_type, pdf_url, font, color_primary, color_text, color_text_secondary,
    color_background, category_order, category_images
) on public.restaurants to anon;

grant select on public.restaurants to authenticated;
grant insert (
    owner_id, name, slug, description, phone, wifi_ssid, wifi_password, cover_url,
    menu_type, pdf_url, font, color_primary, color_text, color_text_secondary,
    color_background, category_order, category_images
) on public.restaurants to authenticated;
grant update (
    name, slug, description, phone, wifi_ssid, wifi_password, cover_url,
    menu_type, pdf_url, font, color_primary, color_text, color_text_secondary,
    color_background, category_order, category_images
) on public.restaurants to authenticated;
grant delete on public.restaurants to authenticated;

grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'menu-assets',
    'menu-assets',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists menu_assets_owner_insert on storage.objects;
create policy menu_assets_owner_insert
on storage.objects for insert to authenticated
with check (
    bucket_id = 'menu-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists menu_assets_owner_read on storage.objects;
create policy menu_assets_owner_read
on storage.objects for select to authenticated
using (
    bucket_id = 'menu-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists menu_assets_owner_update on storage.objects;
create policy menu_assets_owner_update
on storage.objects for update to authenticated
using (
    bucket_id = 'menu-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
    bucket_id = 'menu-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists menu_assets_owner_delete on storage.objects;
create policy menu_assets_owner_delete
on storage.objects for delete to authenticated
using (
    bucket_id = 'menu-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

commit;
