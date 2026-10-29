"use client";

import { Portao, ProvedorAcesso } from "./acesso";
import { ProvedorSistema } from "./provedor";
import { Raiz } from "./raiz";

export function Aplicativo() {
  return (
    <ProvedorAcesso>
      <Portao>
        <ProvedorSistema>
          <Raiz />
        </ProvedorSistema>
      </Portao>
    </ProvedorAcesso>
  );
}
