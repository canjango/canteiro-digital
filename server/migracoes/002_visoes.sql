-- Visões relacionais sobre os documentos: permitem consultar e cruzar os dados com SQL
-- (relatórios, BI, planilhas) sem duplicar a gravação. Os documentos continuam sendo a fonte.

-- conversões tolerantes: valor ausente ou inválido vira NULL em vez de erro
create or replace function cd_num(v text) returns numeric
language sql immutable as $$
  select case when v ~ '^\s*-?\d+(\.\d+)?([eE][-+]?\d+)?\s*$' then v::numeric end
$$;

create or replace function cd_data(v text) returns date
language plpgsql immutable as $$
begin
  if v ~ '^\d{4}-\d{2}-\d{2}' then
    return left(v, 10)::date;
  end if;
  return null;
exception when others then
  return null;
end $$;

create or replace function cd_lista(d jsonb, chave text) returns setof jsonb
language sql immutable as $$
  select e from jsonb_array_elements(case when jsonb_typeof(d -> chave) = 'array' then d -> chave else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'object'
$$;

-- ------------------------------------------------------------------ obras
create view v_obras as
select o.escritorio_id, o.id,
       o.dados ->> 'nome' as nome,
       o.dados ->> 'cliente' as cliente,
       o.dados ->> 'endereco' as endereco,
       o.dados ->> 'responsavel_tecnico' as responsavel_tecnico,
       cd_data(o.dados ->> 'inicio') as inicio,
       cd_data(o.dados ->> 'fim_previsto') as fim_previsto,
       cd_num(o.dados ->> 'orcamento_total') as orcamento_total,
       cd_num(o.dados ->> 'area_construida') as area_construida,
       o.dados ->> 'padrao' as padrao,
       o.dados ->> 'uf_cub' as uf_cub,
       coalesce((o.dados ->> 'exemplo')::boolean, false) as exemplo,
       (select count(*) from cd_lista(o.dados, 'etapas')) as etapas,
       (select coalesce(sum(cd_num(c ->> 'quantidade') * cd_num(c ->> 'valor_unitario')), 0) from cd_lista(o.dados, 'compras') c) as compras_total,
       o.versao, o.atualizado_em
  from obras o
 where o.excluida_em is null;

create view v_etapas as
select o.escritorio_id, o.id as obra_id, o.dados ->> 'nome' as obra,
       e ->> 'codigo' as codigo, e ->> 'nome' as nome, e ->> 'categoria' as categoria,
       cd_num(e ->> 'peso') as peso,
       cd_data(e ->> 'inicio_previsto') as inicio_previsto,
       cd_data(e ->> 'fim_previsto') as fim_previsto,
       cd_num(e ->> 'orcamento') as orcamento,
       e ->> 'equipe' as equipe
  from obras o, cd_lista(o.dados, 'etapas') e
 where o.excluida_em is null;

create view v_compras as
select o.escritorio_id, o.id as obra_id, o.dados ->> 'nome' as obra,
       c ->> 'id' as id, c ->> 'descricao' as descricao, c ->> 'etapa' as etapa, c ->> 'categoria' as categoria,
       cd_num(c ->> 'quantidade') as quantidade, c ->> 'unidade' as unidade,
       cd_num(c ->> 'valor_unitario') as valor_unitario,
       round(coalesce(cd_num(c ->> 'quantidade'), 0) * coalesce(cd_num(c ->> 'valor_unitario'), 0), 2) as total,
       c ->> 'fornecedor' as fornecedor, c ->> 'status' as status, c ->> 'prioridade' as prioridade,
       cd_data(c ->> 'data_necessidade') as data_necessidade,
       cd_data(c ->> 'data_entrega') as data_entrega
  from obras o, cd_lista(o.dados, 'compras') c
 where o.excluida_em is null;

create view v_tarefas_obra as
select o.escritorio_id, o.id as obra_id, o.dados ->> 'nome' as obra,
       t ->> 'id' as id, t ->> 'titulo' as titulo, t ->> 'status' as status,
       t ->> 'responsavel' as responsavel, cd_data(t ->> 'prazo') as prazo, t ->> 'etapa' as etapa
  from obras o, cd_lista(o.dados, 'tarefas') t
 where o.excluida_em is null;

-- ------------------------------------------------------------------ cadastros
create view v_contatos as
select c.escritorio_id, x ->> 'id' as id, x ->> 'nome' as nome, x ->> 'tipo' as tipo, x ->> 'documento' as documento,
       x ->> 'telefone' as telefone, x ->> 'email' as email, x ->> 'cidade' as cidade, x ->> 'especialidade' as especialidade
  from cadastros c, cd_lista(c.dados, 'contatos') x;

create view v_insumos as
select c.escritorio_id, x ->> 'id' as id, x ->> 'codigo' as codigo, x ->> 'descricao' as descricao, x ->> 'unidade' as unidade,
       x ->> 'tipo' as tipo, x ->> 'grupo' as grupo, cd_num(x ->> 'preco') as preco, x ->> 'fonte' as fonte,
       cd_data(x ->> 'atualizado_em') as atualizado_em
  from cadastros c, cd_lista(c.dados, 'insumos') x;

create view v_equipe as
select c.escritorio_id, x ->> 'id' as id, x ->> 'nome' as nome, x ->> 'funcao' as funcao, x ->> 'vinculo' as vinculo,
       x ->> 'telefone' as telefone, cd_num(x ->> 'custo_dia') as custo_dia, x ->> 'obra' as obra_id,
       coalesce((x ->> 'ativo')::boolean, true) as ativo, cd_data(x ->> 'admissao') as admissao,
       (select count(*) from jsonb_array_elements_text(case when jsonb_typeof(x -> 'presencas') = 'array' then x -> 'presencas' else '[]' end)) as presencas
  from cadastros c, cd_lista(c.dados, 'equipe') x;

create view v_produtos as
select c.escritorio_id, x ->> 'id' as id, x ->> 'nome' as nome, x ->> 'categoria' as categoria, x ->> 'marca' as marca,
       x ->> 'codigo' as codigo, x ->> 'fornecedor' as fornecedor, cd_num(x ->> 'preco') as preco, x ->> 'unidade' as unidade,
       x ->> 'link' as link, x ->> 'origem' as origem
  from cadastros c, cd_lista(c.dados, 'produtos') x;

create view v_oportunidades as
select c.escritorio_id, x ->> 'id' as id, x ->> 'titulo' as titulo, x ->> 'cliente' as cliente, x ->> 'tipo' as tipo,
       x ->> 'categoria' as categoria, x ->> 'etapa' as etapa, x ->> 'modalidade' as modalidade,
       cd_num(x ->> 'valor_estimado') as valor_estimado, cd_num(x ->> 'valor_proposta') as valor_proposta,
       cd_num(x ->> 'probabilidade') as probabilidade, x ->> 'responsavel' as responsavel,
       cd_data(x ->> 'data') as data, cd_data(x ->> 'validade') as validade, cd_data(x ->> 'abertura') as abertura
  from cadastros c, cd_lista(c.dados, 'oportunidades') x;

-- ------------------------------------------------------------------ projetos
create view v_projetos as
select c.escritorio_id, p ->> 'id' as id, p ->> 'codigo' as codigo, p ->> 'nome' as nome, p ->> 'cliente' as cliente,
       p ->> 'categoria' as categoria, p ->> 'tipo_obra' as tipo_obra, p ->> 'padrao' as padrao, p ->> 'status' as status,
       p ->> 'origem' as origem, p ->> 'uf' as uf, cd_num(p ->> 'area') as area, p ->> 'responsavel' as responsavel,
       cd_data(p ->> 'inicio') as inicio, cd_data(p ->> 'entrega') as entrega,
       p -> 'honorarios' ->> 'metodo' as metodo_honorario,
       (select count(*) from cd_lista(p, 'fases')) as fases,
       (select coalesce(sum(cd_num(x ->> 'valor')), 0) from cd_lista(p, 'parcelas') x) as parcelas_total,
       (select coalesce(sum(cd_num(x ->> 'valor')), 0) from cd_lista(p, 'parcelas') x where x ->> 'status' = 'Recebida') as recebido,
       (select coalesce(sum(cd_num(x ->> 'valor')), 0) from cd_lista(p, 'aditivos') x) as aditivos,
       (select coalesce(sum(cd_num(x ->> 'horas')), 0) from cd_lista(p, 'horas') x) as horas,
       (select coalesce(sum(cd_num(x ->> 'horas') * cd_num(x ->> 'custo_hora')), 0) from cd_lista(p, 'horas') x) as custo_horas,
       (select coalesce(sum(cd_num(x ->> 'valor')), 0) from cd_lista(p, 'despesas') x) as despesas,
       p ->> 'obra' as obra_id
  from cadastros c, cd_lista(c.dados, 'projetos') p;

create view v_parcelas as
select c.escritorio_id, p ->> 'id' as projeto_id, p ->> 'codigo' as projeto_codigo, p ->> 'nome' as projeto,
       x ->> 'id' as id, x ->> 'descricao' as descricao, x ->> 'fase' as fase, cd_num(x ->> 'valor') as valor,
       cd_data(x ->> 'vencimento') as vencimento, x ->> 'status' as status, cd_data(x ->> 'recebido_em') as recebido_em
  from cadastros c, cd_lista(c.dados, 'projetos') p, cd_lista(p, 'parcelas') x;

create view v_horas as
select c.escritorio_id, p ->> 'id' as projeto_id, p ->> 'codigo' as projeto_codigo, p ->> 'nome' as projeto,
       x ->> 'id' as id, cd_data(x ->> 'data') as data, x ->> 'pessoa' as pessoa, x ->> 'fase' as fase,
       cd_num(x ->> 'horas') as horas, cd_num(x ->> 'custo_hora') as custo_hora,
       round(coalesce(cd_num(x ->> 'horas'), 0) * coalesce(cd_num(x ->> 'custo_hora'), 0), 2) as custo, x ->> 'descricao' as descricao
  from cadastros c, cd_lista(c.dados, 'projetos') p, cd_lista(p, 'horas') x;

create view v_despesas as
select c.escritorio_id, p ->> 'id' as projeto_id, p ->> 'codigo' as projeto_codigo, p ->> 'nome' as projeto,
       x ->> 'id' as id, cd_data(x ->> 'data') as data, x ->> 'descricao' as descricao, x ->> 'categoria' as categoria,
       cd_num(x ->> 'valor') as valor, coalesce((x ->> 'pago')::boolean, false) as pago, x ->> 'fornecedor' as fornecedor
  from cadastros c, cd_lista(c.dados, 'projetos') p, cd_lista(p, 'despesas') x;

create view v_tarefas_projeto as
select c.escritorio_id, p ->> 'id' as projeto_id, p ->> 'codigo' as projeto_codigo, p ->> 'nome' as projeto,
       x ->> 'id' as id, x ->> 'titulo' as titulo, x ->> 'fase' as fase, x ->> 'status' as status,
       x ->> 'prioridade' as prioridade, x ->> 'responsavel' as responsavel, cd_data(x ->> 'prazo') as prazo
  from cadastros c, cd_lista(c.dados, 'projetos') p, cd_lista(p, 'tarefas') x;

create view v_orcamento_itens as
select c.escritorio_id, p ->> 'id' as projeto_id, p ->> 'codigo' as projeto_codigo, p ->> 'nome' as projeto,
       x ->> 'id' as id, x ->> 'ambiente' as ambiente, x ->> 'descricao' as descricao, x ->> 'categoria' as categoria,
       cd_num(x ->> 'quantidade') as quantidade, x ->> 'unidade' as unidade, cd_num(x ->> 'preco') as preco,
       round(coalesce(cd_num(x ->> 'quantidade'), 0) * coalesce(cd_num(x ->> 'preco'), 0), 2) as total,
       x ->> 'status' as status, x ->> 'fornecedor' as fornecedor
  from cadastros c, cd_lista(c.dados, 'projetos') p, cd_lista(p, 'orcamento') x;
