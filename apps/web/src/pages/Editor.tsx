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
const stepNames = [
  "Seus dados",
  "Perfil profissional",
  "Sua trajetória",
  "Modelo e estilo",
];
const sectionNames: Record<string, string> = {
  experience: "Experiência profissional",
  education: "Formação acadêmica",
  courses: "Cursos e certificações",
  skills: "Habilidades",
  languages: "Idiomas",
  projects: "Projetos",
  volunteering: "Voluntariado",
  awards: "Prêmios",
  publications: "Publicações",
  additional: "Informações complementares",
};
export function Editor() {
  const { id } = useParams();
  const [query] = useSearchParams();
  const nav = useNavigate();
  const { user, notice, catalog } = useApp();
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(!id);
  const [saveStatus, setSaveStatus] = useState("Rascunho no navegador");
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [serverPreview, setServerPreview] = useState("");
  const revision = useRef(1);
  const saving = useRef(false);
  const lastSaved = useRef("");
  const locked = useRef(false);
  const initial = () => {
    let d = emptyResume();
    try {
      const raw = localStorage.getItem("forma-draft");
      if (!id && raw) d = resumeSchema.parse(JSON.parse(raw));
    } catch {}
    const t = query.get("modelo");
    if (t && templates.some((x) => x.id === t)) d.templateId = t;
    return d;
  };
  const {
    register,
    watch,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<ResumeData>({
    resolver: zodResolver(resumeSchema),
    defaultValues: initial(),
  });
  const data = watch();
  const serialized = JSON.stringify(data);
  useEffect(() => {
    let active = true;
    locked.current = false;
    if (!id) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    api("/resumes/" + id)
      .then((r) => {
        if (active) {
          reset(r.data);
          revision.current = r.revision;
          lastSaved.current = JSON.stringify(r.data);
          setSaveStatus("Todas as alterações salvas");
          setLoaded(true);
        }
      })
      .catch((e: any) => notice(e.message));
    return () => {
      active = false;
    };
  }, [id, reset]);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(async () => {
      if (!id) {
        try {
          localStorage.setItem("forma-draft", serialized);
          setSaveStatus("Rascunho salvo neste navegador");
        } catch {
          setSaveStatus("Falha ao salvar no navegador");
        }
        return;
      }
      if (lastSaved.current === serialized || saving.current || locked.current)
        return;
      const parsed = resumeSchema.safeParse(JSON.parse(serialized));
      if (!parsed.success) {
        setSaveStatus("Revise os campos para salvar");
        return;
      }
      saving.current = true;
      setSaveStatus("Salvando…");
      try {
        const r = await api("/resumes/" + id, {
          method: "PUT",
          body: JSON.stringify({
            revision: revision.current,
            data: parsed.data,
          }),
        });
        revision.current = r.revision;
        lastSaved.current = serialized;
        setSaveStatus("Todas as alterações salvas");
      } catch (e: any) {
        setSaveStatus(e.message);
        if (e.message.includes("outra aba")) locked.current = true;
      } finally {
        saving.current = false;
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [serialized, loaded, id, saveStatus]);
  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const parsed = resumeSchema.safeParse(data);
      if (parsed.success)
        fetch("/api/preview", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
          signal: controller.signal,
        })
          .then(async (r) => {
            if (r.ok) setServerPreview(await r.text());
          })
          .catch(() => {});
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [serialized, loaded]);
  const changeSections = (sections: ResumeData["sections"]) =>
    setValue("sections", sections, { shouldDirty: true });
  function addItem(sid: string) {
    const item: ResumeItem = {
      id: crypto.randomUUID(),
      title: "",
      organization: "",
      location: "",
      start: "",
      end: "",
      current: false,
      description: "",
    };
    changeSections(
      data.sections.map((s) =>
        s.id === sid ? { ...s, items: [...s.items, item] } : s,
      ),
    );
  }
  function updateItem(
    sid: string,
    iid: string,
    key: keyof ResumeItem,
    value: any,
  ) {
    changeSections(
      data.sections.map((s) =>
        s.id === sid
          ? {
              ...s,
              items: s.items.map((i) =>
                i.id === iid ? { ...i, [key]: value } : i,
              ),
            }
          : s,
      ),
    );
  }
  function moveSection(index: number, offset: number) {
    const arr = [...data.sections];
    [arr[index + offset], arr[index]] = [arr[index], arr[index + offset]];
    changeSections(arr);
  }
  function moveItem(sid: string, index: number, offset: number) {
    changeSections(
      data.sections.map((s) => {
        if (s.id !== sid) return s;
        const items = [...s.items];
        [items[index + offset], items[index]] = [
          items[index],
          items[index + offset],
        ];
        return { ...s, items };
      }),
    );
  }
  async function persist() {
    if (!(await trigger())) {
      notice("Revise os campos antes de continuar.");
      return null;
    }
    if (!user) {
      localStorage.setItem("forma-draft", serialized);
      notice(
        "Rascunho salvo. Entre com Google e abra o editor para continuar.",
      );
      return null;
    }
    if (saving.current || locked.current) {
      notice("Aguarde o salvamento ou recarregue para resolver o conflito.");
      return null;
    }
    saving.current = true;
    try {
      if (id) {
        if (lastSaved.current !== serialized) {
          const r = await api("/resumes/" + id, {
            method: "PUT",
            body: JSON.stringify({ revision: revision.current, data }),
          });
          revision.current = r.revision;
          lastSaved.current = serialized;
        }
        return id;
      }
      const r = await api("/resumes", { method: "POST", body: serialized });
      localStorage.removeItem("forma-draft");
      nav("/editor/" + r.id, { replace: true });
      return r.id;
    } finally {
      saving.current = false;
    }
  }
  async function save() {
    setBusy(true);
    try {
      if (await persist()) notice("Currículo salvo na sua conta.");
    } catch (e: any) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    setBusy(true);
    try {
      const rid = await persist();
      if (!rid) return;
      const key = "forma-checkout:" + rid + ":" + revision.current;
      let requestKey = sessionStorage.getItem(key);
      if (!requestKey) {
        requestKey = crypto.randomUUID();
        sessionStorage.setItem(key, requestKey);
      }
      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify({ resumeId: rid, requestKey }),
      });
      nav("/checkout/" + order.id);
    } catch (e: any) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  }
  const completeness = Math.round(
    ([
      data.personal.fullName,
      data.personal.email,
      data.personal.role,
      data.summary,
      data.sections.some((s) => s.items.length) ? "yes" : "",
    ].filter(Boolean).length /
      5) *
      100,
  );
  if (!loaded)
    return (
      <main className="page center">
        <p>Carregando currículo…</p>
        <Link to="/painel">Voltar ao painel</Link>
      </main>
    );
  return (
    <main className="editor-page">
      <div className="editor-top">
        <div>
          <Link className="back-link" to="/painel">
            <ChevronLeft size={16} /> Meus currículos
          </Link>
          <input
            aria-label="Nome do currículo"
            className="resume-title-input"
            {...register("name")}
          />
          <span className="save-status">
            <span />
            {saveStatus}
          </span>
        </div>
        <div className="editor-top-actions">
          <button className="button secondary" onClick={save} disabled={busy}>
            <Check size={16} /> Salvar
          </button>
          <button className="button" onClick={checkout} disabled={busy}>
            <LockKeyhole size={16} /> Desbloquear PDF
          </button>
        </div>
      </div>
      <div className="editor-layout">
        <aside className="editor-sidebar">
          <div className="eyebrow">SUA HISTÓRIA GANHANDO FORMA</div>
          {stepNames.map((name, i) => (
            <button
              key={name}
              className={step === i ? "editor-step active" : "editor-step"}
              onClick={() => setStep(i)}
            >
              <span>{i + 1}</span>
              {name}
              {i === step && <ChevronRight size={16} />}
            </button>
          ))}
          <div className="progress-card">
            <span>
              Seu progresso <b>{completeness}%</b>
            </span>
            <div className="progress-track">
              <div style={{ width: completeness + "%" }} />
            </div>
            <p>
              Um passo de cada vez.
              <br />
              Você está no caminho certo.
            </p>
          </div>
          {!user && (
            <a href="/api/auth/google" className="login-save">
              <ShieldCheck size={22} />
              <b>Guarde sua história.</b>
              <p>Entre com Google para salvar na nuvem.</p>
              <span>
                Entrar com Google <ArrowRight size={14} />
              </span>
            </a>
          )}
        </aside>
        <section className="editor-form">
          <div className="form-heading">
            <span>ETAPA 0{step + 1} DE 04</span>
            <h1>
              {
                [
                  "Vamos começar com você.",
                  "Apresente seu melhor.",
                  "Cada experiência conta.",
                  "Uma forma que é sua.",
                ][step]
              }
            </h1>
            <p>
              {
                [
                  "Como os recrutadores podem conhecer e encontrar você?",
                  "Mostre onde você quer chegar.",
                  "Organize sua trajetória. Adicione o que faz sentido para você.",
                  "Escolha os detalhes que combinam com sua história.",
                ][step]
              }
            </p>
          </div>
          <form onSubmit={(e) => e.preventDefault()}>
            {step === 0 && (
              <>
                <div className="form-grid">
                  {[
                    ["fullName", "Nome completo", "Marina Oliveira"],
                    ["role", "Cargo desejado", "Designer de Produto"],
                    ["email", "E-mail", "voce@email.com"],
                    ["phone", "Telefone", "(11) 99999-0000"],
                    ["city", "Cidade / UF", "São Paulo, SP"],
                    ["linkedin", "LinkedIn", "https://linkedin.com/in/voce"],
                    ["portfolio", "Portfólio ou site", "https://seusite.com"],
                  ].map(([key, label, placeholder]) => (
                    <label
                      key={key}
                      className={
                        key === "fullName" || key === "portfolio" ? "full" : ""
                      }
                    >
                      {label}
                      <input
                        {...register(`personal.${key}` as any)}
                        placeholder={placeholder}
                        type={
                          key === "email"
                            ? "email"
                            : key === "phone"
                              ? "tel"
                              : "text"
                        }
                      />
                      {(errors.personal as any)?.[key] && (
                        <small className="field-error">
                          {(errors.personal as any)[key].message}
                        </small>
                      )}
                    </label>
                  ))}
                </div>
                <label className="photo-upload">
                  Foto (opcional, JPG/PNG/WebP até 500 KB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500000) {
                        notice("Escolha uma imagem de até 500 KB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () =>
                        setValue("personal.photo", String(reader.result));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {data.personal.photo && (
                  <button
                    className="text-button"
                    onClick={() => setValue("personal.photo", "")}
                  >
                    Remover foto
                  </button>
                )}
                <div className="tip">
                  <ShieldCheck size={19} />
                  <span>
                    Não precisamos de CPF, RG, estado civil ou endereço
                    completo.
                  </span>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <label>
                  Resumo profissional
                  <textarea
                    rows={7}
                    maxLength={4000}
                    {...register("summary")}
                    placeholder="Conte sobre sua experiência e o valor que você pode trazer."
                  />
                  <small>{data.summary.length}/4000 caracteres</small>
                </label>
                <label>
                  Objetivo (opcional)
                  <textarea
                    rows={4}
                    maxLength={4000}
                    {...register("objective")}
                    placeholder="Qual oportunidade você está buscando?"
                  />
                </label>
                <div className="tip">
                  <Sparkles size={19} />
                  <span>
                    Seja específico. Destaque resultados e áreas de atuação.
                  </span>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="section-editor-list">
                  {data.sections.map((s, si) => (
                    <div className="section-editor" key={s.id}>
                      <div className="section-editor-header">
                        <input
                          aria-label="Título da seção"
                          value={s.title}
                          onChange={(e) =>
                            changeSections(
                              data.sections.map((x) =>
                                x.id === s.id
                                  ? { ...x, title: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                        <div>
                          <button
                            aria-label="Subir seção"
                            disabled={si === 0}
                            onClick={() => moveSection(si, -1)}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            aria-label="Descer seção"
                            disabled={si === data.sections.length - 1}
                            onClick={() => moveSection(si, 1)}
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            aria-label={
                              s.visible ? "Ocultar seção" : "Exibir seção"
                            }
                            className={!s.visible ? "muted" : ""}
                            onClick={() =>
                              changeSections(
                                data.sections.map((x) =>
                                  x.id === s.id
                                    ? { ...x, visible: !x.visible }
                                    : x,
                                ),
                              )
                            }
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            aria-label="Remover seção"
                            onClick={() => {
                              if (confirm("Remover esta seção?"))
                                changeSections(
                                  data.sections.filter((x) => x.id !== s.id),
                                );
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {s.items.map((item, ii) => (
                        <div className="entry-form" key={item.id}>
                          <div className="entry-heading">
                            <b>Item {ii + 1}</b>
                            <div>
                              <button
                                aria-label="Subir item"
                                disabled={ii === 0}
                                onClick={() => moveItem(s.id, ii, -1)}
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                aria-label="Descer item"
                                disabled={ii === s.items.length - 1}
                                onClick={() => moveItem(s.id, ii, 1)}
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                aria-label="Remover item"
                                onClick={() =>
                                  changeSections(
                                    data.sections.map((x) =>
                                      x.id === s.id
                                        ? {
                                            ...x,
                                            items: s.items.filter(
                                              (i) => i.id !== item.id,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <div className="form-grid">
                            {[
                              [
                                "title",
                                s.kind === "languages"
                                  ? "Idioma e proficiência"
                                  : s.kind === "skills"
                                    ? "Habilidade"
                                    : "Cargo, curso ou título",
                              ],
                              ["organization", "Empresa ou instituição"],
                              ["location", "Localização"],
                              ["start", "Início"],
                              ["end", "Fim"],
                            ].map(([k, l]) => (
                              <label key={k}>
                                {l}
                                <input
                                  value={String((item as any)[k])}
                                  disabled={k === "end" && item.current}
                                  onChange={(e) =>
                                    updateItem(
                                      s.id,
                                      item.id,
                                      k as keyof ResumeItem,
                                      e.target.value,
                                    )
                                  }
                                  placeholder={
                                    k === "start" || k === "end"
                                      ? "MM/AAAA"
                                      : ""
                                  }
                                />
                              </label>
                            ))}
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={item.current}
                                onChange={(e) =>
                                  updateItem(
                                    s.id,
                                    item.id,
                                    "current",
                                    e.target.checked,
                                  )
                                }
                              />{" "}
                              Atual
                            </label>
                            <label className="full">
                              Descrição, atividades ou resultados
                              <textarea
                                rows={3}
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(
                                    s.id,
                                    item.id,
                                    "description",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                      <button
                        className="add-entry"
                        onClick={() => addItem(s.id)}
                      >
                        <Plus size={16} /> Adicionar item
                      </button>
                    </div>
                  ))}
                </div>
                <label>
                  Adicionar outra seção
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      changeSections([
                        ...data.sections,
                        {
                          id: crypto.randomUUID(),
                          kind: e.target.value as any,
                          title: sectionNames[e.target.value],
                          visible: true,
                          items: [],
                        },
                      ]);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Selecione uma seção</option>
                    {Object.entries(sectionNames).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {step === 3 && (
              <>
                <label>
                  Cor de destaque
                  <div className="color-options">
                    {colors.map((c) => (
                      <button
                        key={c}
                        className={data.color === c ? "color active" : "color"}
                        style={{ background: c }}
                        aria-label={"Cor " + c}
                        aria-pressed={data.color === c}
                        onClick={() => setValue("color", c)}
                      >
                        {data.color === c && <Check size={16} />}
                      </button>
                    ))}
                    <input
                      aria-label="Cor personalizada"
                      type="color"
                      value={data.color}
                      onChange={(e) => setValue("color", e.target.value)}
                    />
                  </div>
                </label>
                {errors.color && (
                  <p className="field-error">{errors.color.message}</p>
                )}
                <label>
                  Tipografia
                  <select {...register("font")}>
                    <option value="sans">Sem serifa · contemporânea</option>
                    <option value="serif">Serifada · clássica</option>
                    <option value="mono">Monoespaçada · técnica</option>
                  </select>
                </label>
                <div className="editor-template-grid">
                  {templates.map((t) => (
                    <button
                      className={
                        data.templateId === t.id
                          ? "editor-template selected"
                          : "editor-template"
                      }
                      key={t.id}
                      onClick={() => setValue("templateId", t.id)}
                    >
                      <div className="editor-template-paper">
                        <Paper mini data={{ ...data, templateId: t.id }} />
                      </div>
                      <b>{t.name}</b>
                      <small>
                        {catalog.find((c: any) => c.id === t.id)
                          ? money(
                              catalog.find((c: any) => c.id === t.id)
                                .priceCents,
                            )
                          : t.ats
                            ? "ATS-friendly"
                            : "Visual"}
                      </small>
                      {data.templateId === t.id && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
                <p className="footnote">
                  A compra libera o arquivo desta versão no modelo escolhido.
                </p>
              </>
            )}
          </form>
          <div className="form-footer">
            <button
              className="button secondary"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            {step < 3 ? (
              <button
                className="button"
                onClick={async () => {
                  if (await trigger()) setStep(step + 1);
                  else notice("Revise os campos indicados.");
                }}
              >
                Continuar <ArrowRight size={16} />
              </button>
            ) : (
              <button className="button" onClick={checkout} disabled={busy}>
                Desbloquear download <LockKeyhole size={16} />
              </button>
            )}
          </div>
        </section>
        <aside className={"preview-panel " + (showPreview ? "visible" : "")}>
          <div className="preview-heading">
            <span>
              <Eye size={16} /> Seu currículo, em tempo real
            </span>
            <button
              className="mobile-menu"
              aria-label="Fechar prévia"
              onClick={() => setShowPreview(false)}
            >
              <X size={18} />
            </button>
            <span className="a4-label">A4</span>
          </div>
          <div className="preview-canvas">
            {serverPreview ? (
              <iframe
                title="Prévia real do currículo no servidor"
                sandbox=""
                srcDoc={serverPreview}
              />
            ) : (
              <Paper data={data} watermark />
            )}
          </div>
          <p>
            <LockKeyhole size={13} /> A marca d’água é removida no PDF
            adquirido.
          </p>
        </aside>
      </div>
      <button
        className="mobile-preview button"
        onClick={() => setShowPreview(true)}
      >
        <Eye size={17} /> Ver prévia
      </button>
    </main>
  );
}
