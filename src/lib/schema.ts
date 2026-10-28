// Created automatically on first use (all statements are idempotent).
export const SCHEMA = `
create table if not exists users (
  id          serial primary key,
  github_id   text unique not null,
  login       text not null,
  name        text,
  avatar_url  text,
  api_key     text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists sessions (
  user_id          int not null references users(id) on delete cascade,
  session_id       text not null,
  repo             text not null,
  branch           text,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  prompts          int not null default 0,
  turns            int not null default 0,
  tool_errors      int not null default 0,
  max_error_streak int not null default 0,
  max_context      int not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table if not exists usage (
  user_id     int not null,
  session_id  text not null,
  day         date not null,
  model       text not null,
  input       bigint not null default 0,
  output      bigint not null default 0,
  cache_write bigint not null default 0,
  cache_write_1h bigint not null default 0,
  cache_read  bigint not null default 0,
  messages    int not null default 0,
  primary key (user_id, session_id, day, model),
  foreign key (user_id, session_id) references sessions(user_id, session_id) on delete cascade
);

alter table usage add column if not exists cache_write_1h bigint not null default 0;

create index if not exists usage_user_day on usage (user_id, day);
`;
