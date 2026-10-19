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
export function Home() {
  const { catalog } = useApp();
  const price = catalog.length
    ? Math.min(...catalog.map((t: any) => t.priceCents))
    : null;
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> SUA CARREIRA, BEM APRESENTADA
          </div>
          <h1>
            Seu próximo capítulo
            <br />
            começa com um
            <br />
            <em>bom currículo.</em>
          </h1>
          <p>
            Você tem a história. A gente ajuda a contar.
            <br />
            Crie um currículo profissional que abre portas,
            <br />
            em poucos minutos.
          </p>
          <div className="hero-buttons">
            <Link to="/editor" className="button large">
              Criar meu currículo <ArrowRight size={19} />
            </Link>
            <Link className="text-button" to="/modelos">
              Explorar modelos <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-assurances">
            <span>
              <Check size={15} /> Edição gratuita
            </span>
            <span>
              <Check size={15} /> Sem cartão de crédito
            </span>
          </div>
          <div className="hero-bottom">
            <FileText size={17} />
            <span>
              Feito para destacar o que faz você ser <b>você.</b>
            </span>
          </div>
        </div>
        <div className="hero-art">
          <span className="art-caption">UM NOVO OLHAR PARA O SEU FUTURO</span>
          <div className="back-paper">
            <div />
            <div />
            <div />
          </div>
          <div className="hero-paper">
            <Paper />
          </div>
          <div className="floating-badge">
            <span>
              <CheckCircle2 size={24} />
            </span>
            <div>
              <b>Pronto para o próximo passo</b>
              <small>Profissional. Autêntico. Seu.</small>
            </div>
          </div>
          <div className="small-badge">
            <Sparkles size={15} /> Seu talento em destaque
          </div>
          <span className="art-star">✳</span>
        </div>
      </section>
      <div className="trust-strip">
        <span>TODO O CUIDADO QUE SUA TRAJETÓRIA MERECE</span>
        <div>
          <ShieldCheck /> Dados protegidos
        </div>
        <div>
          <FileText /> PDF de alta qualidade
        </div>
        <div>
          <LayoutTemplate /> Modelos para cada momento
        </div>
        <div>
          <CheckCircle2 /> Modelos ATS-friendly*
        </div>
      </div>
      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">A PRIMEIRA IMPRESSÃO CONTA</div>
            <h2>Uma forma para cada história.</h2>
            <p>
              Encontre o modelo que combina com você e com seu próximo passo.
            </p>
          </div>
          <Link to="/modelos" className="text-button">
            Ver todos os modelos <ArrowRight size={18} />
          </Link>
        </div>
        <div className="template-grid home-templates">
          {templates.slice(0, 4).map((t, i) => (
            <Link
              key={t.id}
              to={"/editor?modelo=" + t.id}
              className="template-card"
            >
              <div className={"template-preview tint-" + i}>
                <Paper
                  mini
                  data={{ ...demo, templateId: t.id, color: colors[i] }}
                />
                {i === 2 && <span className="template-tag">Mais versátil</span>}
              </div>
              <div className="template-info">
                <div>
                  <h3>{t.name}</h3>
                  <span>Essencial · ATS-friendly</span>
                </div>
                <ArrowUpRight size={19} />
              </div>
            </Link>
          ))}
        </div>
        <p className="footnote">
          * Modelos sinalizados priorizam estrutura simples e texto
          selecionável. A leitura varia conforme o sistema.
        </p>
      </section>
      <section className="how-section" id="como-funciona">
        <div className="section">
          <div className="center">
            <div className="eyebrow">
              MENOS COMPLICAÇÃO. MAIS POSSIBILIDADES.
            </div>
            <h2>Da sua história ao seu novo começo.</h2>
            <p>Três passos simples para se apresentar com confiança.</p>
          </div>
          <div className="steps-grid">
            {[
              {
                n: "01",
                icon: <UserRound />,
                title: "Conte sua história",
                text: "Preencha suas experiências, formação e habilidades. Nós cuidamos da organização.",
              },
              {
                n: "02",
                icon: <LayoutTemplate />,
                title: "Encontre sua forma",
                text: "Escolha um modelo, personalize as cores e acompanhe cada detalhe na prévia.",
              },
              {
                n: "03",
                icon: <Download />,
                title: "Dê o próximo passo",
                text: "Gostou do resultado? Pague uma vez e baixe seu PDF profissional.",
              },
            ].map((s) => (
              <div className="step-card" key={s.n}>
                <span className="step-number">{s.n}</span>
                <div className="step-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section price-section" id="precos">
        <div>
          <div className="eyebrow">TRANSPARENTE DO INÍCIO AO DOWNLOAD</div>
          <h2>
            Invista no seu futuro.
            <br />
            <em>Sem surpresas.</em>
          </h2>
          <p>
            Comece gratuitamente e só pague quando
            <br />
            seu currículo estiver do jeito que você quer.
          </p>
          <div className="price-note">
            <ShieldCheck size={21} /> Pagamento seguro pelo Mercado Pago
          </div>
        </div>
        <div className="price-card">
          <span className="pill">COMPRA ÚNICA</span>
          <h3>Seu currículo, pronto para ir.</h3>
          <div className="price">
            {price !== null ? money(price) : "Consulte no checkout"}
            <small>
              {price !== null
                ? "a partir de · por versão e modelo"
                : "Preço confirmado pelo servidor"}
            </small>
          </div>
          <ul>
            {[
              "Editor completo e prévia gratuitos",
              "8 modelos profissionais",
              "Cores e fontes personalizáveis",
              "PDF A4 com texto selecionável",
              "Arquivo da versão e modelo comprados",
            ].map((x) => (
              <li key={x}>
                <Check size={17} />
                {x}
              </li>
            ))}
          </ul>
          <Link className="button" to="/editor">
            Começar meu currículo <ArrowRight size={18} />
          </Link>
          <p>Sem assinatura. Alterações exigem nova compra.</p>
        </div>
      </section>
      <section className="section faq-section">
        <div>
          <div className="eyebrow">PODE PERGUNTAR</div>
          <h2>
            Vamos tirar
            <br />
            suas dúvidas.
          </h2>
          <p>Mais clareza para começar com tranquilidade.</p>
        </div>
        <div className="faq-list">
          {[
            [
              "Posso criar meu currículo gratuitamente?",
              "Sim. Preenchimento, edição e prévia são gratuitos. O pagamento é necessário somente para baixar o PDF final.",
            ],
            [
              "O que está incluído na compra?",
              "O PDF de uma versão do currículo no modelo escolhido. Novas versões e modelos exigem nova compra.",
            ],
            [
              "Preciso criar uma conta?",
              "Você pode começar no navegador. Para salvar na nuvem, pagar e baixar, entre com Google.",
            ],
            [
              "Quando o download fica disponível?",
              "Após aprovação pelo Mercado Pago e confirmação da transação no servidor.",
            ],
            [
              "Meus dados estão seguros?",
              "O acesso exige autenticação. Você pode exportar seus dados ou excluir sua conta pelo perfil.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Plus size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="cta-band">
        <div>
          <h2>Seu talento merece uma boa apresentação.</h2>
          <p>O próximo capítulo da sua carreira começa com você.</p>
        </div>
        <Link className="button light" to="/editor">
          Criar meu currículo <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
