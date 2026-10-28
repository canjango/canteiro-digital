"use client";

import { Casca } from "./casca";
import { ProvedorSistema } from "./provedor";

export function Aplicativo() {
  return (
    <ProvedorSistema>
      <Casca />
    </ProvedorSistema>
  );
}
