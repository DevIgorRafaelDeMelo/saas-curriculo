export const publicPages = {
  "/": {
    title: "Criar currículo profissional online com prévia grátis | Forma",
    description:
      "Crie seu currículo online com modelos profissionais, edição e prévia gratuitas. Escolha seu estilo e compre o PDF da versão desejada, sem assinatura.",
  },
  "/modelos": {
    title: "Modelos de currículo profissional para editar online | Forma",
    description:
      "Conheça dezoito modelos de currículo, com estilos estruturados e visuais. Personalize seus dados, confira a prévia grátis e compre o PDF quando estiver pronto.",
  },
};
export function pageSeo(pathname: string) {
  const page = publicPages[pathname as keyof typeof publicPages];
  return page
    ? { ...page, index: true }
    : {
        title:
          pathname === "/privacidade"
            ? "Privacidade | Forma"
            : "Sua conta e currículo | Forma",
        description: "Gerencie seus currículos e sua conta na Forma.",
        index: false,
      };
}
