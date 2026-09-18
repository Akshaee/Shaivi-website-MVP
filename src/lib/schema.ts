import content from "../data/content.json";
import { absoluteUrl } from "./seo";

type Json = Record<string, unknown>;

const orgId = (site: URL | undefined) => `${absoluteUrl("/", site)}#organization`;

export function organization(site: URL | undefined): Json {
  const { company, contact, about } = content;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId(site),
    name: company.shortName,
    legalName: company.legalName,
    alternateName: [company.brand, company.alsoKnownAs],
    url: absoluteUrl("/", site),
    logo: absoluteUrl("/brand/shaivi-logo-512.png", site),
    foundingDate: company.foundingDate,
    email: contact.email,
    telephone: telOf(0),
    address: { "@type": "PostalAddress", ...contact.postalAddress },
    contactPoint: [
      { "@type": "ContactPoint", contactType: "sales", telephone: telOf(0), email: contact.email, areaServed: "IN" },
      { "@type": "ContactPoint", contactType: "customer service", telephone: telOf(1), areaServed: "IN" },
      { "@type": "ContactPoint", contactType: "customer service", telephone: telOf(2), areaServed: "IN" },
    ],
    knowsAbout: about.categories.map((c) => c.name),
  };
}

function telOf(index: number): string {
  const phone = content.contact.phones[index];
  return phone ? phone.tel.replace(/^tel:/, "") : "";
}

export function webSite(site: URL | undefined): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/", site)}#website`,
    url: absoluteUrl("/", site),
    name: content.company.brand,
    publisher: { "@id": orgId(site) },
    inLanguage: "en-IN",
  };
}

export function breadcrumbList(trail: { label: string; href: string }[], site: URL | undefined): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: absoluteUrl(item.href, site),
    })),
  };
}

export function aboutPage(site: URL | undefined): Json {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: absoluteUrl("/about/", site),
    name: content.seo["/about/"].title,
    description: content.seo["/about/"].description,
    about: { "@id": orgId(site) },
    inLanguage: "en-IN",
  };
}

export function managingDirector(site: URL | undefined): Json {
  const person = content.leadership.people[0];
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person?.name ?? "",
    jobTitle: person?.role ?? "",
    worksFor: { "@id": orgId(site) },
  };
}

export function collectionPage(site: URL | undefined): Json {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteUrl("/products/", site),
    name: content.seo["/products/"].title,
    description: content.seo["/products/"].description,
    isPartOf: { "@id": `${absoluteUrl("/", site)}#website` },
    about: { "@id": orgId(site) },
    inLanguage: "en-IN",
  };
}

export function contactPage(site: URL | undefined): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: absoluteUrl("/contact/", site),
    name: content.seo["/contact/"].title,
    description: content.seo["/contact/"].description,
    about: { "@id": orgId(site) },
    inLanguage: "en-IN",
  };
}
