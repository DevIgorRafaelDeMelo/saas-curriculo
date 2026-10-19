import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageSeo } from "../../../packages/shared/src/seo.js";

export function Seo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const seo = pageSeo(pathname);
    document.title = seo.title;
    const meta = (name: string, content: string, property = false) => {
      const key = property ? "property" : "name";
      let node = document.head.querySelector<HTMLMetaElement>(
        `meta[${key}="${name}"]`,
      );
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(key, name);
        document.head.append(node);
      }
      node.content = content;
    };
    meta("description", seo.description);
    meta("robots", seo.index ? "index, follow" : "noindex, nofollow");
    meta("og:title", seo.title, true);
    meta("og:description", seo.description, true);
    // Preserve the configured canonical origin, including when an alias is used.
    const base =
      document.querySelector<HTMLMetaElement>('meta[name="forma-origin"]')
        ?.content || location.origin;
    const url = new URL(pathname, base).href;
    meta("og:url", url, true);
    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    if (seo.index) canonical.href = url;
    else canonical.remove();
    document.getElementById("forma-structured-data")?.remove();
    if (seo.index) {
      const script = document.createElement("script");
      script.id = "forma-structured-data";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Forma",
        url: base + "/",
        inLanguage: "pt-BR",
      });
      document.head.append(script);
    }
  }, [pathname]);
  return null;
}

