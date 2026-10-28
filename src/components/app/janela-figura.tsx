"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { carregarDetalhe, carregarFigura } from "@/lib/core/catalogo";
import { Nota } from "./comum";
import { useSistema } from "./provedor";

/** Janela com a imagem de referência do item de checklist ou o detalhe técnico da etapa. */
export function JanelaFigura() {
  const { sis, acao } = useSistema();
  const f = sis.ui.figura;
  const o = sis.obra;
  const etapa = f && o ? o.etapas.find((e) => e.codigo === f.codigo) : undefined;
  const item = f && etapa && f.item !== "_etapa" ? etapa.checklist.find((i) => i.id === f.item) : undefined;
  const chave = f ? `${f.codigo}|${f.item}` : "";
  const [conteudo, setConteudo] = React.useState<{ chave: string; svg: string | null; titulo: string } | null>(null);

  React.useEffect(() => {
    if (!f || !etapa) return;
    let ativo = true;
    if (f.item === "_etapa") {
      void carregarDetalhe(etapa.codigo).then((d) => ativo && setConteudo({ chave, svg: d?.svg ?? null, titulo: d?.titulo ?? etapa.nome }));
    } else if (item) {
      void carregarFigura(item.texto).then((svg) => ativo && setConteudo({ chave, svg, titulo: item.texto }));
    }
    return () => {
      ativo = false;
    };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  const aberto = Boolean(f && etapa && (f.item === "_etapa" || item));
  const pronto = conteudo && conteudo.chave === chave ? conteudo : null;
  const titulo = pronto?.titulo ?? item?.texto ?? etapa?.nome ?? "";
  const rotulo = etapa ? `${etapa.nome} · ${f?.item === "_etapa" ? "detalhe técnico" : "item do checklist"}` : "";
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) acao("ui.figura_fechar"); }}>
      {aberto && (
        <DialogContent aria-describedby="figura-nota">
          <div className="pr-8">
            <p className="mb-0.5 text-[0.76rem] font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
            <DialogTitle>{titulo}</DialogTitle>
          </div>
          {pronto ? (
            pronto.svg ? (
              <div className="desenho overflow-hidden rounded-md border bg-card" dangerouslySetInnerHTML={{ __html: pronto.svg }} />
            ) : (
              <Nota>Sem imagem de referência para este item.</Nota>
            )
          ) : (
            <div className="aspect-[360/220] animate-pulse rounded-md bg-muted" />
          )}
          <DialogDescription id="figura-nota">Desenho esquemático de referência, sem escala. O projeto executivo prevalece.</DialogDescription>
        </DialogContent>
      )}
    </Dialog>
  );
}
