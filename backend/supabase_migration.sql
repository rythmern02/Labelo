-- ============================================================
-- Labelo Supabase Schema Migration
-- Run this in the Supabase SQL Editor for your project
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Bounties ─────────────────────────────────────────────────────────────
create table if not exists public.bounties (
  id                uuid primary key default gen_random_uuid(),
  dataset_id        text not null unique,         -- keccak256 bytes32 hex
  enterprise_address text not null,
  name              text not null,
  description       text,
  reward_per_task   bigint not null,              -- in USDC micro-units (6 decimals)
  total_tasks       integer not null,
  completed_tasks   integer not null default 0,
  status            text not null default 'active'
                      check (status in ('active', 'completed', 'closed')),
  created_at        timestamptz not null default now()
);

-- ─── Tasks ────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  bounty_id      uuid not null references public.bounties(id) on delete cascade,
  dataset_id     text not null,
  prompt_a       text not null,
  prompt_b       text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'assigned', 'completed')),
  assigned_to    text,                            -- worker EVM address
  assigned_at    timestamptz,
  worker_address text,
  winner         text check (winner in ('A', 'B')),
  completed_at   timestamptz,
  tx_hash        text,                            -- on-chain transaction hash
  created_at     timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────
create index if not exists tasks_status_idx on public.tasks(status)
  where status = 'pending';

create index if not exists tasks_bounty_idx on public.tasks(bounty_id);
create index if not exists tasks_worker_idx on public.tasks(worker_address);
create index if not exists bounties_enterprise_idx on public.bounties(enterprise_address);

-- ─── RPC Function: increment_completed_tasks ──────────────────────────────
-- Called by backend after successful on-chain payment
create or replace function public.increment_completed_tasks(bounty_dataset_id text)
returns void
language plpgsql
security definer
as $$
begin
  update public.bounties
  set
    completed_tasks = completed_tasks + 1,
    status = case
      when completed_tasks + 1 >= total_tasks then 'completed'
      else status
    end
  where dataset_id = bounty_dataset_id;
end;
$$;

-- ─── Row Level Security (optional for production) ─────────────────────────
-- For the hackathon demo, disable RLS and use the service key
alter table public.bounties disable row level security;
alter table public.tasks    disable row level security;
