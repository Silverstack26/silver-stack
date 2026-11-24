-- Run this in the Supabase SQL Editor.
-- Each signed-in user can only read and modify their own silver inventory.
create extension if not exists pgcrypto;

create table if not exists public.silver_stack_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('Rounds','Bars','Constitutional','Foreign coins','Collectibles','Other')),
  quantity numeric(14,6) not null check (quantity > 0),
  fine_oz_each numeric(14,8) not null check (fine_oz_each >= 0),
  cost_total numeric(14,2) not null default 0 check (cost_total >= 0),
  purchase_date date,
  dealer text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.silver_stack_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_oz numeric(14,6) not null default 100 check (goal_oz > 0),
  updated_at timestamptz not null default now()
);

alter table public.silver_stack_items enable row level security;
alter table public.silver_stack_settings enable row level security;

create policy "Users manage their own silver items"
on public.silver_stack_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users manage their own stack settings"
on public.silver_stack_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists silver_stack_items_user_idx on public.silver_stack_items(user_id);
