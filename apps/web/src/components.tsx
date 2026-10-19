import React, { useState, useEffect, useRef } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutTemplate,
  ShieldCheck,
  Download,
  Plus,
  Trash2,
  Copy,
  LogOut,
  Menu,
  X,
  Eye,
  CheckCircle2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  LockKeyhole,
  LoaderCircle,
  UserRound,
  Settings2,
} from "lucide-react";
import {
  emptyResume,
  resumeSchema,
  templates,
  type ResumeData,
  type ResumeItem,
} from "../../../packages/shared/src/index.js";
import { useApp } from "./lib";
export function Logo() {
  return (
    <Link className="logo" to="/">
      <span className="logo-icon">
        <FileText size={21} />
      </span>
      forma<span className="logo-dot">.</span>
    </Link>
  );
}
export const demo: ResumeData = {
  ...emptyResume(),
  personal: {
    ...emptyResume().personal,
    fullName: "Marina Oliveira",
    role: "Designer de Produto",
    city: "São Paulo, SP",
    email: "marina@email.com",
    phone: "(11) 99999-0000",
  },
  summary:
    "Transformo problemas complexos em experiências simples e significativas. 6 anos criando produtos digitais com propósito.",
  sections: [
    {
      id: "ex",
      kind: "experience",
      title: "Experiência profissional",
      visible: true,
      items: [
        {
          id: "1",
          title: "Product Designer Sênior",
          organization: "Estúdio Horizonte",
          location: "São Paulo",
          start: "2022",
          end: "",
          current: true,
          description:
            "Liderança de design de produtos digitais, da descoberta à entrega. Evolução do design system com times multidisciplinares.",
        },
        {
          id: "2",
          title: "Product Designer",
          organization: "Nexo Tecnologia",
          location: "São Paulo",
          start: "2019",
          end: "2022",
          current: false,
          description:
            "Pesquisa com usuários, prototipação e interfaces para plataformas digitais.",
        },
      ],
    },
    {
      id: "ed",
      kind: "education",
      title: "Formação acadêmica",
      visible: true,
      items: [
        {
          id: "3",
          title: "Bacharelado em Design",
          organization: "Universidade de São Paulo",
          location: "",
          start: "2015",
          end: "2018",
          current: false,
          description: "",
        },
      ],
    },
    {
      id: "sk",
      kind: "skills",
      title: "Habilidades",
      visible: true,
      items: [
        {
          id: "4",
          title: "Figma · UX Research · Design Systems",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: "Prototipação · Design de interação · Inglês avançado",
        },
      ],
    },
  ],
};
export function Paper({
  data = demo,
  mini = false,
  watermark = false,
}: {
  data?: ResumeData;
  mini?: boolean;
  watermark?: boolean;
}) {
  return (
    <div
      className={`resume-paper ${data.templateId} ${mini ? "mini" : ""}`}
      style={
        {
          "--accent": data.color,
          fontFamily:
            data.font === "serif"
              ? "Georgia,serif"
              : data.font === "mono"
                ? "monospace"
                : "Arial,sans-serif",
        } as React.CSSProperties
      }
    >
      <div className="paper-header">
        {data.personal.photo && (
          <img
            className="paper-photo"
            src={data.personal.photo}
            alt="Foto do currículo"
          />
        )}
        <div className="paper-name">{data.personal.fullName || "Seu nome"}</div>
        <div className="paper-role">
          {data.personal.role || "Seu próximo cargo"}
        </div>
        <div className="paper-contact">
          {[data.personal.city, data.personal.email, data.personal.phone]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div className="paper-contact">
          {[data.personal.linkedin, data.personal.portfolio]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      {data.summary && (
        <section>
          <h4>Perfil profissional</h4>
          <p>{data.summary}</p>
        </section>
      )}
      {data.objective && (
        <section>
          <h4>Objetivo</h4>
          <p>{data.objective}</p>
        </section>
      )}
      {data.sections
        .filter((s) => s.visible && s.items.length)
        .map((s) => (
          <section key={s.id}>
            <h4>{s.title}</h4>
            {s.items.map((i) => (
              <div className="paper-item" key={i.id}>
                <div className="paper-item-head">
                  <b>{i.title}</b>
                  <span>
                    {i.start}
                    {i.start ? " — " : ""}
                    {i.current ? "Atual" : i.end}
                  </span>
                </div>
                <p className="paper-org">
                  {i.organization}
                  {i.location ? " · " + i.location : ""}
                </p>
                <p>{i.description}</p>
              </div>
            ))}
          </section>
        ))}
      {watermark && <span className="paper-watermark">PRÉVIA</span>}
    </div>
  );
}
export function LoginGate({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (user === undefined)
    return <main className="page center">Carregando sua conta…</main>;
  if (!user)
    return (
      <main className="page center gate">
        <LockKeyhole size={36} />
        <h1>Um espaço para sua história.</h1>
        <p>Entre para salvar currículos e acompanhar compras.</p>
        <a className="button" href="/api/auth/google">
          Entrar com Google <ArrowRight size={18} />
        </a>
      </main>
    );
  return <>{children}</>;
}
