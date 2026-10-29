"use client";

import * as React from "react";
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, FolderPlusIcon, GavelIcon, HandshakeIcon, PencilIcon, ScaleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import * as pj from "@/lib/core/projetos";
import * as pz from "@/lib/core/prazos";
import { dataBr, diasEntre, moeda, num, pct, valorBr } from "@/lib/core/util";
import { cn } from "@/lib/utils";
import { Campo, CampoNumero, Nota, Pill } from "./comum";
import { BotaoExcluir, Busca, casa, GRADE_FORM, Indicadores, Sugestoes, Vazio } from "./modulo-comum";
import { useEnviar, useSistema } from "./provedor";

type Tipo = "Proposta" | "Licitação";

export function TelaOportunidades() {
  const { sis, acao } = useSistema();
  const g = sis.cadastros;
  const [tipo, setTipo] = React.useState<Tipo>(() => (g.oportunidades.some((o) => o.tipo === "Licitação") && !g.oportunidades.some((o) => o.tipo === "Proposta") ? "Licitação" : "Proposta"));
  const [busca, setBusca] = React.useState("");
  const [finais, setFinais] = React.useState(false);
  const aberta = g.oportunidades.find((o) => o.id === sis.ui.editando);
  if (aberta) return <DetalheOportunidade o={aberta} />;
  const r = pj.resumoGeral(g, sis.hoje);
  const etapas = (tipo === "Licitação" ? pj.ETAPAS_LICITACAO : pj.ETAPAS_PROPOSTA).filter((e) => finais || !pj.FINAIS.includes(e));
  const lista = g.oportunidades.filter((o) => o.tipo === tipo && casa(busca, o.titulo, o.cliente, o.edital, o.processo, o.tipo_obra));
  const proximas = g.oportunidades.filter((o) => o.tipo === "Licitação" && !pj.FINAIS.includes(o.etapa) && o.abertura >= sis.hoje).sort((a, b) => a.abertura.localeCompare(b.abertura));
  return (
    <>
      <Indicadores
        itens={[
          { rotulo: "Em aberto", valor: String(r.oportunidades_abertas), sub: "propostas e licitações" },
          { rotulo: "Valor em disputa", valor: moeda(r.em_disputa), sub: `ponderado pela chance: ${moeda(r.ponderado)}` },
          { rotulo: "Taxa de conversão", valor: r.conversao === null ? "—" : pct(r.conversao), sub: "ganhas ÷ decididas" },
          { rotulo: "Próxima sessão", valor: proximas[0] ? dataBr(proximas[0].abertura) : "—", sub: proximas[0] ? `${proximas[0].titulo} · em ${diasEntre(sis.hoje, proximas[0].abertura)} d` : "nenhuma licitação agendada" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5" role="radiogroup" aria-label="Tipo">
          {(["Proposta", "Licitação"] as Tipo[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)}
              className={cn("inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium", tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {t === "Proposta" ? <HandshakeIcon className="size-4" /> : <GavelIcon className="size-4" />}{t === "Proposta" ? "Propostas particulares" : "Licitações"}
              <span className="font-mono text-[0.7rem] opacity-75">{g.oportunidades.filter((o) => o.tipo === t && !pj.FINAIS.includes(o.etapa)).length}</span>
            </button>
          ))}
        </div>
        <Busca valor={busca} aoMudar={setBusca} placeholder={tipo === "Licitação" ? "Buscar objeto, órgão, edital…" : "Buscar proposta, cliente…"} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={finais} onChange={(e) => setFinais(e.target.checked)} className="size-4" />Mostrar encerradas</label>
        <Button className="ml-auto" onClick={() => acao("ui.novo", { qual: `opo-${tipo}` })} variant={sis.ui.novo === `opo-${tipo}` ? "outline" : "default"}>
          {sis.ui.novo === `opo-${tipo}` ? "Fechar formulário" : tipo === "Licitação" ? "Nova licitação" : "Nova proposta"}
        </Button>
      </div>
      {sis.ui.novo === `opo-${tipo}` && <FormOportunidade tipo={tipo} />}
      {lista.length ? (
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {etapas.map((et) => {
            const col = lista.filter((o) => o.etapa === et);
            return (
              <section key={et} className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted p-2" aria-label={et}>
                <h3 className="flex items-center gap-2 px-1 text-[0.82rem] font-semibold"><Pill texto={et} /><span className="font-mono text-xs font-normal text-muted-foreground">{col.length}</span>
                  <span className="ml-auto font-mono text-[0.72rem] font-normal text-muted-foreground">{col.length ? moeda(col.reduce((s, o) => s + (o.valor_proposta || o.valor_estimado), 0)) : ""}</span>
                </h3>
                {col.map((o) => <CartaoOportunidade key={o.id} o={o} />)}
                {!col.length && <p className="px-1 py-2 text-[0.78rem] text-muted-foreground">—</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <Vazio>{tipo === "Licitação" ? "Nenhuma licitação. Cadastre um edital para controlar prazos (impugnação, sessão, recurso), garantias e documentos de habilitação." : "Nenhuma proposta. Cadastre as propostas enviadas a clientes para acompanhar o funil até virar projeto."}</Vazio>
      )}
    </>
  );
}

function CartaoOportunidade({ o }: { o: pj.Oportunidade }) {
  const { sis, acao } = useSistema();
  const al = pj.alertasOportunidade(o, sis.cadastros.documentos, sis.cadastros.regras, sis.hoje);
  const docs = o.documentos.length ? `${o.documentos.filter((d) => d.ok).length}/${o.documentos.length} docs` : "";
  return (
    <button type="button" onClick={() => acao("ui.editar", { id: o.id })}
      className={cn("flex flex-col gap-1 rounded-md border bg-card p-2.5 text-left text-card-foreground hover:border-foreground", al.some((a) => a.nivel === "critico") && "border-critico")}>
      <span className="text-sm font-semibold">{o.titulo}</span>
      <span className="text-[0.76rem] text-muted-foreground">{[o.cliente, o.tipo_obra].filter(Boolean).join(" · ")}</span>
      <span className="flex flex-wrap items-center gap-x-2 text-[0.76rem]">
        <span className="font-mono">{moeda(o.valor_proposta || o.valor_estimado)}</span>
        {o.tipo === "Licitação" && o.abertura && <span className={cn(o.abertura < sis.hoje && !pj.FINAIS.includes(o.etapa) && "text-critico")}>sessão {dataBr(o.abertura)}</span>}
        {o.tipo === "Proposta" && <span className="text-muted-foreground">{num(o.probabilidade)}% de chance</span>}
        {docs && <span className="text-muted-foreground">{docs}</span>}
      </span>
      {al.length > 0 && <span className={cn("text-[0.74rem] font-medium", al.some((a) => a.nivel === "critico") ? "text-critico" : "text-atencao")}>{al[0].titulo}</span>}
    </button>
  );
}

function FormOportunidade({ tipo, o, aoFechar }: { tipo: Tipo; o?: pj.Oportunidade; aoFechar?: () => void }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const etapas = tipo === "Licitação" ? pj.ETAPAS_LICITACAO : pj.ETAPAS_PROPOSTA;
  const [criterio, setCriterio] = React.useState(o?.criterio ?? "Técnica e preço");
  const [objeto, setObjeto] = React.useState(o?.objeto ?? "Serviço especial");
  const minimo = pz.prazoMinimoPublicacao(criterio, objeto);
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{o ? `Editar ${o.titulo}` : tipo === "Licitação" ? "Nova licitação" : "Nova proposta"}</h3>
      <form className="flex flex-col gap-4" onSubmit={(e) => { const r = enviar("opo.salvar", { tipo, ...(o ? { id: o.id } : {}) })(e); if (r.ok) aoFechar?.(); }}>
        <fieldset className={GRADE_FORM}>
          <Campo rotulo={tipo === "Licitação" ? "Objeto" : "Título da proposta"} className="col-span-full"><Input name="titulo" required maxLength={200} defaultValue={o?.titulo} placeholder={tipo === "Licitação" ? "Ex.: Projeto executivo da UBS do bairro X" : "Ex.: Residência em condomínio — Altiplano"} /></Campo>
          <Campo rotulo={tipo === "Licitação" ? "Órgão" : "Cliente"}><Input name="cliente" maxLength={200} defaultValue={o?.cliente} list="clientes-opo" /></Campo>
          <Campo rotulo="Tipo de obra">
            <NativeSelect name="tipo_obra" defaultValue={o?.tipo_obra ?? (tipo === "Licitação" ? "Edifício público / administrativo" : "Residência unifamiliar")}>
              {pj.CATEGORIAS.map((c) => <optgroup key={c} label={c}>{pj.CATEGORIAS_OBRA[c].map((t) => <option key={t}>{t}</option>)}</optgroup>)}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Padrão"><NativeSelect name="padrao" defaultValue={o?.padrao ?? (tipo === "Licitação" ? "Público" : "Alto padrão")}>{pj.PADROES_PROJETO.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Área (m²)"><CampoNumero name="area" texto={o?.area ? num(o.area) : ""} placeholder="0" /></Campo>
          <Campo rotulo={tipo === "Licitação" ? "Valor estimado (edital)" : "Valor esperado"}><CampoNumero name="valor_estimado" texto={o?.valor_estimado ? valorBr(o.valor_estimado) : ""} placeholder="0,00" /></Campo>
          <Campo rotulo="Valor da nossa proposta"><CampoNumero name="valor_proposta" texto={o?.valor_proposta ? valorBr(o.valor_proposta) : ""} placeholder="0,00" /></Campo>
          <Campo rotulo="Etapa"><NativeSelect name="etapa" defaultValue={o?.etapa ?? etapas[0]}>{etapas.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
          <Campo rotulo="Chance de fechar (%)"><Input name="probabilidade" type="number" min={0} max={100} defaultValue={o?.probabilidade ?? (tipo === "Licitação" ? 20 : 40)} /></Campo>
          <Campo rotulo="Responsável"><Input name="responsavel" maxLength={80} defaultValue={o?.responsavel} list="pessoas-opo" /></Campo>
          {tipo === "Proposta" && <>
            <Campo rotulo="Contato"><Input name="contato" maxLength={200} defaultValue={o?.contato} placeholder="Telefone / e-mail" /></Campo>
            <Campo rotulo="Validade da proposta"><Input name="validade" type="date" defaultValue={o?.validade} /></Campo>
          </>}
        </fieldset>
        {tipo === "Licitação" && (
          <fieldset className={GRADE_FORM}>
            <legend className="mb-1 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">Edital (Lei 14.133/2021)</legend>
            <Campo rotulo="Nº do edital"><Input name="edital" maxLength={40} defaultValue={o?.edital} placeholder="Ex.: CC 012/2026" /></Campo>
            <Campo rotulo="Processo"><Input name="processo" maxLength={60} defaultValue={o?.processo} /></Campo>
            <Campo rotulo="UASG / código do órgão"><Input name="orgao_uasg" maxLength={40} defaultValue={o?.orgao_uasg} /></Campo>
            <Campo rotulo="Modalidade"><NativeSelect name="modalidade" defaultValue={o?.modalidade ?? "Concorrência"}>{pz.MODALIDADES.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
            <Campo rotulo="Critério de julgamento"><NativeSelect name="criterio" value={criterio} onChange={(e) => setCriterio(e.target.value)}>{pz.CRITERIOS.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
            <Campo rotulo="Natureza do objeto"><NativeSelect name="objeto" value={objeto} onChange={(e) => setObjeto(e.target.value)}>{pz.OBJETOS.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
            <Campo rotulo="Publicação do edital"><Input name="publicacao" type="date" defaultValue={o?.publicacao} /></Campo>
            <Campo rotulo="Abertura / sessão"><Input name="abertura" type="date" defaultValue={o?.abertura} /></Campo>
            <Campo rotulo="Plataforma"><Input name="plataforma" maxLength={80} defaultValue={o?.plataforma} list="plataformas" placeholder="Ex.: Compras.gov.br" /></Campo>
            <Campo rotulo="Link do edital"><Input name="link" type="url" maxLength={300} defaultValue={o?.link} placeholder="https://…" /></Campo>
            <Campo rotulo="Garantia de proposta (%)"><Input name="garantia_proposta" inputMode="decimal" defaultValue={o?.garantia_proposta ? num(o.garantia_proposta) : ""} placeholder="0 (máx. 1%)" /></Campo>
            <Campo rotulo="Garantia contratual (%)"><Input name="garantia_contrato" inputMode="decimal" defaultValue={o?.garantia_contrato ? num(o.garantia_contrato) : ""} placeholder="0 (até 5%)" /></Campo>
            <Nota className="col-span-full text-[0.78rem]">
              {minimo ? <>Prazo mínimo entre publicação e abertura para este critério/objeto: <b>{minimo.dias} dias úteis</b> ({minimo.base}).</> : "Informe o critério e a natureza do objeto para conferir o prazo mínimo (art. 55)."} Impugnação e esclarecimento: até 3 dias úteis antes da abertura (art. 164).
            </Nota>
            <Sugestoes id="plataformas" valores={["Compras.gov.br", "BLL Compras", "Licitações-e (Banco do Brasil)", "Portal de Compras Públicas", "BNC", "Licitanet", "Portal da prefeitura"]} />
          </fieldset>
        )}
        <Campo rotulo="Observação"><Textarea name="observacao" rows={2} maxLength={3000} defaultValue={o?.observacao} /></Campo>
        <Sugestoes id="clientes-opo" valores={[...sis.cadastros.contatos.filter((c) => c.tipo === "Cliente").map((c) => c.nome), ...sis.cadastros.oportunidades.map((x) => x.cliente)].filter(Boolean)} />
        <Sugestoes id="pessoas-opo" valores={sis.cadastros.equipe.map((m) => m.nome)} />
        <div className="flex gap-2">
          <Button type="submit">{o ? "Salvar" : "Cadastrar"}</Button>
          <Button type="button" variant="outline" onClick={() => (aoFechar ? aoFechar() : acao("ui.novo", { qual: `opo-${tipo}` }))}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

function DetalheOportunidade({ o }: { o: pj.Oportunidade }) {
  const { sis, acao } = useSistema();
  const enviar = useEnviar();
  const [editar, setEditar] = React.useState(false);
  const g = sis.cadastros;
  const etapas: readonly string[] = o.tipo === "Licitação" ? pj.ETAPAS_LICITACAO : pj.ETAPAS_PROPOSTA;
  const [etapa, setEtapa] = React.useState(o.etapa);
  React.useEffect(() => setEtapa(o.etapa), [o.etapa]);
  const pzs = pj.prazosLicitacao(o);
  const al = pj.alertasOportunidade(o, g.documentos, g.regras, sis.hoje);
  const projeto = o.projeto ? g.projetos.find((p) => p.id === o.projeto) : undefined;
  const ref = o.abertura || sis.hoje;
  const linha = (rotulo: string, valor: React.ReactNode, destaque = false) => (
    <><dt className="text-muted-foreground">{rotulo}</dt><dd className={cn("text-right", destaque && "font-semibold text-critico")}>{valor}</dd></>
  );
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="outline" size="sm" onClick={() => acao("ui.editar", { id: o.id })}><ArrowLeftIcon />Funil</Button>
        <div className="min-w-0 flex-1 basis-64">
          <p className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">{o.tipo === "Licitação" ? <GavelIcon className="size-3.5" /> : <HandshakeIcon className="size-3.5" />}{o.tipo}{o.edital && ` · ${o.modalidade} ${o.edital}`}</p>
          <h2 className="break-words text-xl font-bold">{o.titulo}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.82rem] text-muted-foreground"><Pill texto={o.etapa} /><Pill texto={o.padrao} />{[o.cliente, o.tipo_obra, o.area ? `${num(o.area)} m²` : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditar((x) => !x)}><PencilIcon />{editar ? "Fechar edição" : "Editar"}</Button>
          {o.link && <a className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted" href={o.link} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon className="size-4" />Edital</a>}
          {pj.GANHAS.includes(o.etapa) && (projeto
            ? <Button size="sm" onClick={() => acao("proj.abrir", { id: projeto.id })}><FolderPlusIcon />Abrir {projeto.codigo}</Button>
            : <Button size="sm" onClick={() => acao("opo.projeto", { id: o.id })}><FolderPlusIcon />Gerar projeto</Button>)}
        </div>
      </div>
      {editar && <FormOportunidade tipo={o.tipo} o={o} aoFechar={() => setEditar(false)} />}
      {al.length > 0 && (
        <Card className="gap-1 border-atencao/50 p-3">
          {al.map((a, k) => (
            <p key={k} className="flex items-start gap-2 text-[0.84rem]"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.nivel === "critico" ? "bg-critico" : a.nivel === "atencao" ? "bg-atencao" : "bg-info")} /><span><b>{a.titulo}</b> — <span className="text-muted-foreground">{a.detalhe}</span></span></p>
          ))}
        </Card>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-4">
          <h3 className="text-[0.92rem] font-semibold">Andamento</h3>
          <ol className="flex flex-wrap gap-1" aria-label="Etapas">
            {etapas.map((e) => (
              <li key={e}><span className={cn("inline-block rounded-sm border px-1.5 py-0.5 text-[0.72rem]", e === o.etapa ? "border-foreground bg-sinal font-semibold text-sinal-foreground" : etapas.indexOf(e) < etapas.indexOf(o.etapa) && !pj.FINAIS.includes(e) ? "bg-muted text-muted-foreground line-through" : "text-muted-foreground")}>{e}</span></li>
            ))}
          </ol>
          <form className={GRADE_FORM} onSubmit={enviar("opo.etapa", { id: o.id })}>
            <Campo rotulo="Mover para"><NativeSelect name="etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}>{etapas.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Campo>
            {["Perdida", "Desistência"].includes(etapa) && <Campo rotulo="Motivo" className="col-span-full sm:col-span-2"><Input name="motivo" maxLength={300} defaultValue={o.motivo} placeholder="Preço, prazo, documentação, cliente desistiu…" /></Campo>}
            {o.tipo === "Licitação" && ["Sessão / julgamento", "Habilitação", "Recurso", "Homologada", "Perdida"].includes(etapa) && (
              <>
                <Campo rotulo="Classificação (posição)"><Input name="classificacao" type="number" min={0} defaultValue={o.classificacao || ""} /></Campo>
                <Campo rotulo="Ata / intimação do resultado"><Input name="intimacao" type="date" defaultValue={o.intimacao} /></Campo>
              </>
            )}
            <Button type="submit" disabled={etapa === o.etapa && !["Sessão / julgamento", "Habilitação", "Recurso", "Homologada", "Perdida"].includes(etapa)}><CheckIcon />Atualizar</Button>
          </form>
          {o.motivo && ["Perdida", "Desistência"].includes(o.etapa) && <Nota>Motivo: {o.motivo}</Nota>}
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t pt-2 text-[0.86rem]">
            {linha(o.tipo === "Licitação" ? "Valor estimado (edital)" : "Valor esperado", <span className="font-mono">{moeda(o.valor_estimado)}</span>)}
            {linha("Nossa proposta", <span className="font-mono">{moeda(o.valor_proposta)}</span>)}
            {pzs.desconto !== null && linha("Desconto sobre o estimado", <span className="font-mono">{num(Math.round(pzs.desconto * 100) / 100)}%</span>, pzs.desconto > 30)}
            {o.area > 0 && o.valor_proposta > 0 && linha("Proposta por m²", <span className="font-mono">{moeda(o.valor_proposta / o.area)}</span>)}
            {linha("Chance de fechar", `${num(o.probabilidade)}% · ponderado ${moeda(((o.valor_proposta || o.valor_estimado) * o.probabilidade) / 100)}`)}
            {o.tipo === "Proposta" && o.validade && linha("Validade", dataBr(o.validade), o.validade < sis.hoje)}
            {o.responsavel && linha("Responsável", o.responsavel)}
            {o.contato && linha("Contato", o.contato)}
          </dl>
          {pzs.desconto !== null && pzs.desconto > 30 && <Nota className="text-[0.76rem]">Desconto acima de 30%: confira a exequibilidade da proposta (o edital pode exigir demonstração).</Nota>}
          {o.observacao && <Nota className="whitespace-pre-line">{o.observacao}</Nota>}
        </Card>
        {o.tipo === "Licitação" ? (
          <Card className="gap-3 p-4">
            <h3 className="flex items-center gap-2 text-[0.92rem] font-semibold"><ScaleIcon className="size-4" />Prazos e garantias (Lei 14.133)</h3>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[0.86rem]">
              {linha("Publicação do edital", o.publicacao ? dataBr(o.publicacao) : "—")}
              {linha("Abertura / sessão", o.abertura ? `${dataBr(o.abertura)}${o.abertura >= sis.hoje ? ` (em ${diasEntre(sis.hoje, o.abertura)} d)` : ""}` : "—")}
              {o.publicacao && o.abertura && linha("Dias úteis entre publicação e abertura", `${pzs.dias_publicacao}${pzs.minimo ? ` de ${pzs.minimo.dias} mín. (${pzs.minimo.base})` : ""}`, pzs.prazo_irregular)}
              {linha("Limite p/ impugnar ou pedir esclarecimento (art. 164)", pzs.impugnacao ? dataBr(pzs.impugnacao) : "—", Boolean(pzs.impugnacao && pzs.impugnacao < sis.hoje && ["Análise do edital", "Em preparação"].includes(o.etapa)))}
              {linha("Ata / intimação do resultado", o.intimacao ? dataBr(o.intimacao) : "—")}
              {o.intimacao && linha("Razões de recurso até (art. 165, I)", dataBr(pzs.recurso))}
              {o.intimacao && linha("Contrarrazões até (art. 165, § 3º)", dataBr(pzs.contrarrazoes))}
              {linha(`Garantia de proposta (${num(o.garantia_proposta)}%)`, <span className="font-mono">{moeda(pzs.garantia_proposta_valor)}</span>, o.garantia_proposta > pz.LIMITE_GARANTIA_PROPOSTA)}
              {linha(`Garantia contratual (${num(o.garantia_contrato)}%)`, <span className="font-mono">{moeda(pzs.garantia_contrato_valor)}</span>, o.garantia_contrato > pz.LIMITE_GARANTIA_CONTRATO_MAJORADA)}
              {o.plataforma && linha("Plataforma", o.plataforma)}
            </dl>
            <Nota className="text-[0.74rem]">Dias úteis sem sábados, domingos e feriados nacionais; Carnaval e Corpus Christi contam pelo lado seguro. Feriados estaduais e municipais não entram: confira o calendário do órgão.</Nota>
          </Card>
        ) : (
          <Card className="gap-2 p-4">
            <h3 className="text-[0.92rem] font-semibold">Próximos passos</h3>
            <ul className="list-disc pl-5 text-[0.86rem] text-muted-foreground">
              <li>Proposta com escopo por fase (LV → PE), revisões incluídas e forma de pagamento.</li>
              <li>Acompanhe: após 7 dias de “Proposta enviada” o sistema sugere follow-up.</li>
              <li>Ganhou? Mova para “Ganha” e gere o projeto com o valor da proposta.</li>
            </ul>
          </Card>
        )}
      </div>
      {o.tipo === "Licitação" && (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <h3 className="text-[0.92rem] font-semibold">Documentos de habilitação</h3>
            <span className="font-mono text-[0.78rem] text-muted-foreground">{o.documentos.filter((d) => d.ok).length}/{o.documentos.length} prontos</span>
            <span className="text-[0.76rem] text-muted-foreground">· validade conferida na data da sessão ({dataBr(ref)})</span>
          </div>
          <ul className="divide-y">
            {o.documentos.map((d, k) => {
              const doc = d.documento ? g.documentos.find((x) => x.id === d.documento) : undefined;
              const sit = doc ? pj.situacaoDocumento(doc, ref, 0) : null;
              return (
                <li key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                  <label className="flex min-w-0 flex-1 basis-60 cursor-pointer items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={d.ok} onChange={() => acao("opo.doc", { id: o.id, indice: k })} className="size-4 shrink-0" />
                    <span className={cn(d.ok && "text-muted-foreground line-through")}>{d.nome}</span>
                  </label>
                  {doc && sit && <><Pill texto={sit} />{doc.validade && <span className="text-[0.76rem] text-muted-foreground">validade {dataBr(doc.validade)}</span>}</>}
                  {!doc && d.documento === "" && <span className="text-[0.74rem] text-muted-foreground">específico do edital</span>}
                </li>
              );
            })}
          </ul>
          <form className="flex flex-wrap items-end gap-2 border-t px-4 py-3" onSubmit={enviar("opo.doc_add", { id: o.id }, { limpar: true })}>
            <Campo rotulo="Outro documento exigido no edital" className="min-w-0 flex-1 basis-64"><Input name="nome" required maxLength={200} placeholder="Ex.: Atestado de projeto de UBS acima de 500 m²" /></Campo>
            <Button type="submit" variant="outline">Incluir</Button>
          </form>
          {!g.documentos.length && <Nota className="border-t px-4 py-2 text-[0.76rem]">Cadastre os documentos da empresa em Habilitação para conferir as validades automaticamente.</Nota>}
        </Card>
      )}
      <div className="border-t pt-3"><BotaoExcluir acaoNome="opo.remover" id={o.id} rotulo="Excluir" pergunta={`Excluir “${o.titulo}”?`} /></div>
    </>
  );
}
