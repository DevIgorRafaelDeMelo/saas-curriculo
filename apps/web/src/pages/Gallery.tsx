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
} from "../../../../packages/shared/src/index.js";
import { api, money, useApp, colors, statuses } from "../lib";
import { Paper, LoginGate, demo } from "../components";
export function Gallery() {
  const { catalog } = useApp();
  const [filter, setFilter] = useState("todos");
  const [preview] = useState(() => {
    try {
      return resumeSchema.parse(
        JSON.parse(localStorage.getItem("forma-draft") || "null"),
      );
    } catch {
      return demo;
    }
  });
  return (
    <main className="page">
      <div className="center gallery-head">
        <div className="eyebrow">SEU TALENTO, SUA FORMA</div>
        <h1>Encontre seu próximo currículo.</h1>
        <p>
          Oito estilos. Muitas possibilidades. Uma história que só você pode
          contar.
        </p>
        <div className="tabs">
          {["todos", "ats", "visual"].map((f) => (
            <button
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
              key={f}
            >
              {f === "todos"
                ? "Todos os modelos"
                : f === "ats"
                  ? "ATS-friendly"
                  : "Visuais"}
            </button>
          ))}
        </div>
      </div>
      <div className="template-grid">
        {templates
          .filter(
            (t) => filter === "todos" || (filter === "ats" ? t.ats : !t.ats),
          )
          .map((t, i) => {
            const server = catalog.find((c: any) => c.id === t.id);
            return (
              <Link
                key={t.id}
                to={"/editor?modelo=" + t.id}
                className="template-card"
              >
                <div className={"template-preview tint-" + (i % 4)}>
                  <Paper
                    mini
                    watermark={preview !== demo}
                    data={{
                      ...preview,
                      templateId: t.id,
                      color: colors[i % colors.length],
                    }}
                  />
                </div>
                <div className="template-info">
                  <div>
                    <h3>{server?.name || t.name}</h3>
                    <span>
                      {server ? money(server.priceCents) + " · " : ""}
                      {t.ats ? "ATS-friendly" : "Visual"}
                    </span>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
                <p className="template-description">{t.description}</p>
              </Link>
            );
          })}
      </div>
    </main>
  );
}
