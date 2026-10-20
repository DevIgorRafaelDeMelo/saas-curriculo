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
 @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:${font};font-size:10pt;line-height:1.5;color:#24332f;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}header{border-bottom:2px solid ${d.color};padding-bottom:18px;margin-bottom:20px}h1{font-size:28pt;line-height:1.15;margin:0 0 6px;color:${d.color};letter-spacing:-1px}h2{font-size:11pt;text-transform:uppercase;letter-spacing:1.2px;color:${d.color};border-bottom:1px solid #d9e2df;padding-bottom:5px;margin-top:22px;break-after:avoid}p{margin:4px 0}a{color:inherit;overflow-wrap:anywhere}.contact{font-size:9pt;max-width:100%;overflow-wrap:anywhere}.role{font-size:13pt}.line{display:flex;justify-content:space-between;gap:12px}.line small{white-space:nowrap}.description{white-space:pre-wrap;overflow-wrap:anywhere}article{break-inside:avoid;margin-bottom:13px}header img{width:65px;height:65px;object-fit:cover;float:right;border-radius:50%}section{break-inside:auto}.organization{color:#62706b}.executive header{background:${d.color};padding:24px;color:white}.executive h1{color:white}.classic h1,.academic h1{font-family:Georgia,serif}.classic header{text-align:center}.minimal h1{color:#222}.minimal header{border-bottom:0}.minimal h2{border:0}.creative header{border-left:12px solid ${d.color};border-bottom:0;padding-left:20px}.corporate h2{background:#edf3f1;padding:5px 8px}.academic h2{text-transform:none;font-family:Georgia,serif;font-size:13pt}.first header{border-top:7px solid ${d.color};padding-top:20px}.contemporary header{display:grid;grid-template-columns:1fr auto;align-items:end;border-bottom:5px solid ${d.color};padding-bottom:14px}.contemporary h1{font-size:32pt}.restrained{color:#303634}.restrained header{border-bottom:1px solid #89938e}.restrained h1{color:#303634;font-size:25pt;letter-spacing:0}.restrained h2{color:#303634;border-bottom-color:#aab1ad}.impact header{background:linear-gradient(110deg,${d.color} 0 74%,#e8eee8 74%);padding:25px;color:#fff;border:0}.impact h1{color:#fff;font-size:31pt}.impact h2{color:${d.color};border-left:5px solid ${d.color};border-bottom:0;padding:2px 0 2px 9px}.editorial h1,.classic-modern h1{font-family:Georgia,serif}.editorial header{border-top:1px solid ${d.color};border-bottom:6px double ${d.color};padding:14px 0;text-align:center}.editorial h2{font-family:Georgia,serif;text-transform:none;letter-spacing:.4px}.technical{font-size:9.5pt}.technical header{background:#f1f5f3;border-left:8px solid ${d.color};padding:18px}.technical h1{font-family:"Courier New",monospace;font-size:25pt}.technical h2{font-family:"Courier New",monospace;border-bottom:2px solid ${d.color}}.essential header{border-bottom:0;padding-bottom:5px}.essential h1{color:#202725;font-size:30pt;font-weight:400}.essential h2{border:0;color:#202725;letter-spacing:.5px;margin-top:26px}.architect{border-left:15px solid ${d.color};padding-left:18px}.architect header{border-bottom:0;background:#f3f6f2;padding:18px;margin-left:-18px}.architect h2{background:${d.color};color:#fff;border:0;padding:5px 9px}.sidebar{padding-left:39mm}.sidebar:before{content:"";position:fixed;left:0;top:0;bottom:0;width:29mm;background:${d.color};z-index:-1}.sidebar header{border-bottom:3px solid ${d.color};padding-top:5px}.sidebar h1{font-size:26pt}.sidebar h2{border-left:4px solid ${d.color};border-bottom:0;padding:1px 0 1px 8px}.classic-modern header{border-top:6px solid ${d.color};border-bottom:1px solid ${d.color};padding:16px 0}.classic-modern h2{font-family:Georgia,serif;text-transform:none;letter-spacing:.5px}.nordic{color:#34413d}.nordic header{background:#f0f5f1;border-bottom:0;padding:22px}.nordic h1{font-size:27pt}.nordic h2{background:#e5eee7;border:0;padding:5px 8px;color:#345b4f}.nordic article{border-left:1px solid #c9d6cd;padding-left:10px}.watermark{position:fixed;top:42%;left:0;width:100%;text-align:center;transform:rotate(-30deg);font: bold 55pt Arial;color:rgba(50,80,70,.12);z-index:5;pointer-events:none}@media screen{body{padding:35px;background:white;max-width:794px;margin:auto}}
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
