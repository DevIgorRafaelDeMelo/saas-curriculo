import { escapeHtml as e } from "./security.js";
import {
  templates,
  type ResumeData,
} from "../../../packages/shared/src/index.js";
export function renderResume(d: ResumeData, watermark = false) {
  const style = templates.find((t) => t.id === d.templateId)?.style || "modern";
  const font = {
    sans: "Arial, sans-serif",
    serif: "Georgia, serif",
    mono: "Courier New, monospace",
  }[d.font];
  const sections = d.sections
    .filter((s) => s.visible && s.items.length)
    .map(
      (s) =>
        `<section><h2>${e(s.title)}</h2>${s.items.map((i) => `<article><div class="line"><strong>${e(i.title)}</strong><small>${e(i.start)}${i.start ? " — " : ""}${i.current ? "Atual" : e(i.end)}</small></div><p class="organization">${e(i.organization)}${i.location ? " · " + e(i.location) : ""}</p><p class="description">${e(i.description)}</p></article>`).join("")}</section>`,
    )
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${e(d.personal.fullName)}</title><style>
 @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:${font};font-size:10pt;line-height:1.5;color:#24332f;margin:0;-webkit-print-color-adjust:exact}header{border-bottom:2px solid ${d.color};padding-bottom:18px;margin-bottom:20px}h1{font-size:28pt;line-height:1.15;margin:0 0 6px;color:${d.color};letter-spacing:-1px}h2{font-size:11pt;text-transform:uppercase;letter-spacing:1.2px;color:${d.color};border-bottom:1px solid #d9e2df;padding-bottom:5px;margin-top:22px;break-after:avoid}p{margin:4px 0}a{color:inherit;overflow-wrap:anywhere}.contact{font-size:9pt;max-width:100%;overflow-wrap:anywhere}.role{font-size:13pt}.line{display:flex;justify-content:space-between;gap:12px}.line small{white-space:nowrap}.description{white-space:pre-wrap;overflow-wrap:anywhere}article{break-inside:avoid;margin-bottom:13px}header img{width:65px;height:65px;object-fit:cover;float:right;border-radius:50%}section{break-inside:auto}.organization{color:#62706b}.executive header{background:${d.color};padding:24px;color:white}.executive h1{color:white}.classic h1,.academic h1{font-family:Georgia,serif}.classic header{text-align:center}.minimal h1{color:#222}.minimal header{border-bottom:0}.minimal h2{border:0}.creative header{border-left:12px solid ${d.color};border-bottom:0;padding-left:20px}.corporate h2{background:#edf3f1;padding:5px 8px}.academic h2{text-transform:none;font-family:Georgia,serif;font-size:13pt}.first header{border-top:7px solid ${d.color};padding-top:20px}.watermark{position:fixed;top:42%;left:0;width:100%;text-align:center;transform:rotate(-30deg);font: bold 55pt Arial;color:rgba(50,80,70,.12);z-index:5;pointer-events:none}@media screen{body{padding:35px;background:white;max-width:794px;margin:auto}}
 </style></head><body class="${style}">${watermark ? '<div class="watermark">PRÉVIA GRATUITA</div>' : ""}<header>${d.personal.photo ? `<img src="${e(d.personal.photo)}" alt="">` : ""}<h1>${e(d.personal.fullName || "Seu nome")}</h1><p class="role">${e(d.personal.role || "Seu próximo cargo")}</p><p class="contact">${[d.personal.city, d.personal.email, d.personal.phone].filter(Boolean).map(e).join(" · ")}</p><p class="contact">${[
   d.personal.linkedin,
   d.personal.portfolio,
 ]
   .filter(Boolean)
   .map((u) => `<a href="${e(u)}">${e(u)}</a>`)
   .join(
     " · ",
   )}</p></header>${d.summary ? `<section><h2>Perfil profissional</h2><p class="description">${e(d.summary)}</p></section>` : ""}${d.objective ? `<section><h2>Objetivo</h2><p class="description">${e(d.objective)}</p></section>` : ""}${sections}</body></html>`;
}
let activePdfJobs = 0;
export async function generatePdf(data: ResumeData) {
  const concurrency = Number(process.env.PDF_CONCURRENCY || 1);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error("PDF_CONCURRENCY deve ser um inteiro entre 1 e 4.");
  if (activePdfJobs >= concurrency)
    throw Object.assign(
      new Error("Geração ocupada. Tente novamente em instantes."),
      { status: 429 },
    );
  activePdfJobs++;
  let browser: import("playwright").Browser | undefined;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.route("**/*", (r) => r.abort());
    await page.setContent(renderResume(data), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    try {
      await browser?.close();
    } finally {
      activePdfJobs--;
    }
  }
}
