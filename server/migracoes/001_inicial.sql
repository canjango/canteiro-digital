-- Canteiro Digital — esquema inicial
-- Escritório → usuários e sessões; obras e cadastros guardados como documentos JSONB versionados
-- (o mesmo formato que o aplicativo usa), com histórico de versões e sequência de alterações
-- para a sincronização entre aparelhos.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ escritórios
create table escritorios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(nome) between 2 and 120),
  criado_em   timestamptz not null default now()
);

-- ------------------------------------------------------------------ usuários
create table usuarios (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  nome           text not null check (length(nome) between 2 and 80),
  usuario        text not null unique check (usuario ~ '^[a-z0-9._-]{3,32}$'),
  papel          text not null default 'membro' check (papel in ('admin', 'membro')),
  -- senha: PBKDF2-SHA-256 (mesmo formato do acesso local, para poder importar as contas)
  sal            text not null,
  hash           text not null,
  iteracoes      integer not null check (iteracoes >= 100000),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  ultimo_acesso  timestamptz,
  senha_trocada_em timestamptz not null default now()
);
create index usuarios_escritorio on usuarios (escritorio_id);

-- ------------------------------------------------------------------ sessões (o token fica só com o cliente; aqui, o hash)
create table sessoes (
  token_hash  bytea primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  criada_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  ultimo_uso  timestamptz not null default now(),
  ip          inet,
  agente      text
);
create index sessoes_usuario on sessoes (usuario_id);
create index sessoes_expira on sessoes (expira_em);

-- ------------------------------------------------------------------ tentativas de entrada (bloqueio progressivo)
create table tentativas_login (
  usuario       text primary key,
  erros         integer not null default 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------------ sequência de alterações (sincronização incremental)
create sequence seq_alteracao;

create or replace function marcar_alteracao() returns trigger
language plpgsql as $$
begin
  new.alteracao := nextval('seq_alteracao');
  new.atualizado_em := now();
  return new;
end $$;

-- ------------------------------------------------------------------ obras (um documento por obra)
create table obras (
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  id             text not null check (length(id) between 1 and 80),
  dados          jsonb not null check (jsonb_typeof(dados) = 'object'),
  versao         integer not null default 1,
  alteracao      bigint not null default nextval('seq_alteracao'),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references usuarios(id) on delete set null,
  excluida_em    timestamptz,
  primary key (escritorio_id, id)
);
create index obras_alteracao on obras (escritorio_id, alteracao);
create trigger obras_alteracao before insert or update on obras
  for each row execute function marcar_alteracao();

-- ------------------------------------------------------------------ cadastros (contatos, insumos, equipe, projetos… — um documento por escritório)
create table cadastros (
  escritorio_id  uuid primary key references escritorios(id) on delete cascade,
  dados          jsonb not null check (jsonb_typeof(dados) = 'object'),
  versao         integer not null default 1,
  alteracao      bigint not null default nextval('seq_alteracao'),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references usuarios(id) on delete set null
);
create trigger cadastros_alteracao before insert or update on cadastros
  for each row execute function marcar_alteracao();

-- ------------------------------------------------------------------ histórico de versões
-- Guarda a versão anterior a cada alteração (no máximo uma a cada 5 minutos por documento e
-- pessoa, para não encher o banco com cada clique) e mantém as 200 mais recentes de cada documento.
create table historico (
  id             bigserial primary key,
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  tipo           text not null check (tipo in ('obra', 'cadastros')),
  registro       text not null,
  versao         integer not null,
  dados          jsonb not null,
  acao           text not null check (acao in ('alteracao', 'exclusao')),
  usuario_id     uuid references usuarios(id) on delete set null,
  em             timestamptz not null default now()
);
create index historico_registro on historico (escritorio_id, tipo, registro, em desc);

create or replace function guardar_historico() returns trigger
language plpgsql as $$
declare
  -- as duas tabelas têm colunas diferentes: lê por JSON para o mesmo gatilho servir às duas
  v_old jsonb := to_jsonb(old);
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_tipo text := case when tg_table_name = 'obras' then 'obra' else 'cadastros' end;
  v_registro text := coalesce(v_old ->> 'id', 'geral');
  v_acao text := case when tg_op = 'DELETE' or (v_new ->> 'excluida_em' is not null and v_old ->> 'excluida_em' is null) then 'exclusao' else 'alteracao' end;
  v_usuario uuid := case when tg_op = 'DELETE' then old.atualizado_por else new.atualizado_por end;
begin
  if tg_op = 'UPDATE' and new.dados = old.dados and v_acao = 'alteracao' then
    return new;
  end if;
  if v_acao = 'exclusao' or not exists (
    select 1 from historico h
     where h.escritorio_id = old.escritorio_id and h.tipo = v_tipo and h.registro = v_registro
       and h.usuario_id is not distinct from v_usuario and h.em > now() - interval '5 minutes'
  ) then
    insert into historico (escritorio_id, tipo, registro, versao, dados, acao, usuario_id)
    values (old.escritorio_id, v_tipo, v_registro, old.versao, old.dados, v_acao, v_usuario);
    delete from historico
     where id in (
       select id from historico
        where escritorio_id = old.escritorio_id and tipo = v_tipo and registro = v_registro
        order by em desc offset 200
     );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger obras_historico after update or delete on obras
  for each row execute function guardar_historico();
create trigger cadastros_historico after update on cadastros
  for each row execute function guardar_historico();
