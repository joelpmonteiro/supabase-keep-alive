# Supabase Keep Alive

Backend mínimo em Bun que faz uma requisição periódica para um endpoint do Supabase e expõe um healthcheck HTTP.

> Use apenas conforme os limites e os termos do seu plano Supabase. Um ping não garante que qualquer política de pausa seja desativada.

## Configuração

```bash
cp .env.example .env
```

Defina no `.env`:

- `SUPABASE_URL`: URL base do projeto Supabase.
- `SUPABASE_TABLE`: nome de uma tabela existente. Se `SUPABASE_PING_URL` não for informado, o programa faz `SELECT * ... LIMIT 1` nessa tabela.
- `SUPABASE_PING_URL`: endpoint exato que será acessado; quando informado, tem prioridade sobre `SUPABASE_URL` e `SUPABASE_TABLE`.
- `SUPABASE_ANON_KEY`: chave pública anon para autenticar a consulta e respeitar as políticas RLS.
- `KEEP_ALIVE_INTERVAL_MINUTES`: intervalo entre os pings em minutos; o padrão é `120` (2 horas).
- `PORT`: porta HTTP; o padrão é `3000`.

Exemplo usando uma tabela existente chamada `clientes`:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_TABLE=clientes
SUPABASE_ANON_KEY=sua-chave-anon
```

A URL gerada será `SUPABASE_URL/rest/v1/clientes?select=*&limit=1`. A tabela precisa estar exposta na API e ter uma política RLS que permita `SELECT` para a chave usada.

## Executar

```bash
bun install
bun run start
```

Para desenvolvimento:

```bash
bun run dev
```

## Endpoints

- `GET /` ou `GET /health`: retorna o status e o resultado do último ping.
- `POST /ping`: dispara um ping manual e retorna `202`.

## Criar uma tabela de healthcheck (opcional)

No SQL Editor do Supabase:

```sql
create table if not exists public.keep_alive (
  id integer primary key default 1,
  constraint keep_alive_single_row check (id = 1)
);

insert into public.keep_alive (id) values (1) on conflict (id) do nothing;

alter table public.keep_alive enable row level security;
create policy "public can read keep alive"
  on public.keep_alive for select
  using (true);
```

Depois, configure `SUPABASE_PING_URL` para essa tabela.
