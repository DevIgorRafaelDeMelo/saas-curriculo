export const publicPages = {
  "/": {
    title: "Currículo grátis online: crie e edite seu currículo | Forma",
    description:
      "Crie e edite seu currículo grátis online com modelos profissionais e prévia gratuita. O PDF final é pago, sem assinatura.",
  },
  "/modelos": {
    title: "Modelos de currículo grátis para editar online | Forma",
    description:
      "Conheça modelos de currículo para criar e editar grátis online. Personalize, veja a prévia gratuita e pague somente pelo PDF final.",
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
