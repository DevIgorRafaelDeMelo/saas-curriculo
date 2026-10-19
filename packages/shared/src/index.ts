import { z } from "zod";
function readableColor(color: string) {
  const rgb = color
    .slice(1)
    .match(/../g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return (
    1.05 / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05) >= 4.5
  );
}
const text = z.string().trim().max(4000);
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || /^https:\/\//i.test(v), "Use uma URL HTTPS");
export const itemSchema = z.object({
  id: z.string().max(100),
  title: text,
  organization: text,
  location: text,
  start: z.string().max(20),
  end: z.string().max(20),
  current: z.boolean(),
  description: text,
});
export const sectionSchema = z.object({
  id: z.string().max(100),
  kind: z.enum([
    "experience",
    "education",
    "courses",
    "skills",
    "languages",
    "projects",
    "volunteering",
    "awards",
    "publications",
    "additional",
  ]),
  title: z.string().min(1).max(100),
  visible: z.boolean(),
  items: z.array(itemSchema).max(40),
});
export const resumeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateId: z.string().max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .refine(
      (v) => /^#[0-9a-fA-F]{6}$/.test(v) && readableColor(v),
      "Escolha uma cor mais escura para manter a legibilidade",
    ),
  font: z.enum(["sans", "serif", "mono"]),
  personal: z.object({
    fullName: z.string().trim().max(150),
    role: z.string().max(150),
    city: z.string().max(120),
    email: z
      .string()
      .max(200)
      .refine(
        (v) => !v || z.string().email().safeParse(v).success,
        "E-mail inválido",
      ),
    phone: z.string().max(40),
    linkedin: url,
    portfolio: url,
    photo: z
      .string()
      .max(750000)
      .refine(
        (v) =>
          !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
        "Imagem inválida",
      ),
  }),
  summary: text,
  objective: text,
  sections: z.array(sectionSchema).max(20),
});
export type ResumeData = z.infer<typeof resumeSchema>;
export type ResumeItem = z.infer<typeof itemSchema>;
export const templates = [
  {
    id: "classico",
    name: "Clássico",
    description: "Elegância que atravessa o tempo",
    style: "classic",
    ats: true,
  },
  {
    id: "executivo",
    name: "Executivo",
    description: "Presença para o próximo grande passo",
    style: "executive",
    ats: true,
  },
  {
    id: "moderno",
    name: "Moderno",
    description: "Uma nova perspectiva para sua carreira",
    style: "modern",
    ats: true,
  },
  {
    id: "minimalista",
    name: "Minimalista",
    description: "O essencial, com intenção",
    style: "minimal",
    ats: true,
  },
  {
    id: "criativo",
    name: "Criativo",
    description: "Personalidade em cada detalhe",
    style: "creative",
    ats: false,
  },
  {
    id: "corporativo",
    name: "Corporativo",
    description: "Clareza e estrutura profissional",
    style: "corporate",
    ats: true,
  },
  {
    id: "academico",
    name: "Acadêmico",
    description: "Conhecimento em primeiro plano",
    style: "academic",
    ats: true,
  },
  {
    id: "primeiro-emprego",
    name: "Primeiro Emprego",
    description: "Seu potencial merece ser visto",
    style: "first",
    ats: true,
  },
] as const;
export function emptyResume(): ResumeData {
  return {
    name: "Meu currículo",
    templateId: "moderno",
    color: "#176b5b",
    font: "sans",
    personal: {
      fullName: "",
      role: "",
      city: "",
      email: "",
      phone: "",
      linkedin: "",
      portfolio: "",
      photo: "",
    },
    summary: "",
    objective: "",
    sections: [
      {
        id: "experience",
        kind: "experience",
        title: "Experiência profissional",
        visible: true,
        items: [],
      },
      {
        id: "education",
        kind: "education",
        title: "Formação acadêmica",
        visible: true,
        items: [],
      },
      {
        id: "skills",
        kind: "skills",
        title: "Habilidades",
        visible: true,
        items: [],
      },
    ],
  };
}
export function isPayable(data: ResumeData) {
  return Boolean(data.personal.fullName.trim() && data.personal.email.trim());
}
