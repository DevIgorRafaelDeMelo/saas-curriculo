import { createContext, useContext } from "react";
export async function api(url: string, options: RequestInit = {}) {
  const r = await fetch("/api" + url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error || "Não foi possível completar a solicitação");
  }
  return r.status === 204 ? null : r.json();
}
export const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v / 100,
  );
export const Context = createContext<any>(null);
export const useApp = () => useContext(Context);
export const colors = [
  "#176b5b",
  "#243b67",
  "#6f4c77",
  "#a45a37",
  "#272b30",
  "#7b6c45",
];
export const statuses: Record<string, string> = {
  created: "Criado",
  pending: "Aguardando pagamento",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Estornado",
  charged_back: "Chargeback",
  in_process: "Em análise",
  in_mediation: "Em mediação",
};
