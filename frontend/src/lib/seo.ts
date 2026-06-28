import { useEffect } from "react";

const siteUrl = "https://boorise.fr";
const siteName = "Boorise";
const defaultTitle = "Boorise - ERP pour artisans";
const defaultDescription =
  "Boorise aide les artisans a gerer clients, materiaux, devis, factures et calculs de quantites avec pertes, lots et marges.";
const defaultImage = `${siteUrl}/brand/boorise-og.png`;

type SeoOptions = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  image?: string;
  noIndex?: boolean;
};

export function useSeo({
  title = defaultTitle,
  description = defaultDescription,
  canonicalPath = "/",
  image = defaultImage,
  noIndex = false,
}: SeoOptions) {
  useEffect(() => {
    const canonicalUrl = canonicalPath.startsWith("http")
      ? canonicalPath
      : `${siteUrl}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;

    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", noIndex ? "noindex,nofollow" : "index,follow");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setCanonical(canonicalUrl);
  }, [canonicalPath, description, image, noIndex, title]);
}

export const seoDefaults = {
  siteName,
  siteUrl,
  title: defaultTitle,
  description: defaultDescription,
  image: defaultImage,
};

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.content = content;
}

function setCanonical(href: string) {
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.rel = "canonical";
    document.head.appendChild(node);
  }
  node.href = href;
}
