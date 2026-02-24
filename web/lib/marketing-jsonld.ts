import { seoResources, type ResourceArticle, type ResourceFaq } from "./seo-resources";

type JsonLdValue = Record<string, unknown> | Array<unknown>;

type FaqServiceJsonLdInput = {
  serviceName: string;
  serviceType: string;
  siteUrl: string;
  pageUrl: string;
  areaServed?: string[];
  faqs: ResourceFaq[];
  offersUrl?: string;
};

export function resolveMarketingSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://senaldigital.xyz").replace(/\/$/, "");
}

export function serializeJsonLd(jsonLd: JsonLdValue) {
  return JSON.stringify(jsonLd);
}

export const buenosAiresIntentFaqs: ResourceFaq[] = [
  {
    question: "Trabajan solo en CABA o tambien en GBA?",
    answer: "Operamos en CABA y GBA. Podemos ayudarte tanto con una sola sucursal como con multiples puntos de venta.",
  },
  {
    question: "La plataforma sirve para locales chicos?",
    answer: "Si. Expanded Signage esta pensado para pymes y comercios que buscan implementar carteleria digital sin complejidad tecnica.",
  },
  {
    question: "Cuanto tarda la implementacion?",
    answer: "Depende de la cantidad de pantallas, pero la puesta en marcha suele ser rapida. En la cotizacion te damos tiempos concretos.",
  },
];

export const retailIntentFaqs: ResourceFaq[] = [
  {
    question: "Puedo cambiar precios y promociones en el dia?",
    answer: "Si. Puedes actualizar contenido en minutos y programar cambios por franja horaria o fecha.",
  },
  {
    question: "Funciona para vidriera y tambien dentro del local?",
    answer: "Si. Puedes gestionar pantallas de vidriera, cajas y sectores internos desde el mismo panel.",
  },
  {
    question: "Que necesito para arrancar?",
    answer: "Con una pantalla compatible y conectividad basica puedes empezar. Te guiamos en la implementacion.",
  },
];

export const franquiciasIntentFaqs: ResourceFaq[] = [
  {
    question: "Se puede controlar el contenido de todas las franquicias desde un solo lugar?",
    answer: "Si. Puedes centralizar el contenido y definir que muestra cada sucursal segun zona, horario o tipo de pantalla.",
  },
  {
    question: "Hay perfiles o permisos por equipo?",
    answer: "Si. Podemos configurar distintos niveles de acceso para marketing, operaciones y responsables de cada local.",
  },
  {
    question: "Sirve para lanzamientos y campanas temporales?",
    answer: "Si. Puedes programar campanas por fechas y horarios para activarlas o retirarlas automaticamente.",
  },
];

export const menuRestaurantesIntentFaqs: ResourceFaq[] = [
  {
    question: "Se pueden programar menus por horario?",
    answer: "Si. Puedes definir desayuno, almuerzo, merienda y cena con cambios automaticos por franja horaria.",
  },
  {
    question: "Puedo actualizar precios o combos rapido?",
    answer: "Si. El panel permite editar y publicar cambios en minutos para una o varias sucursales.",
  },
  {
    question: "Sirve para cadenas gastronomicas?",
    answer: "Si. Es ideal para centralizar menus y promociones en multiples locales.",
  },
];

export const preciosIntentFaqs: ResourceFaq[] = [
  {
    question: "Como se define el precio de carteleria digital?",
    answer: "Depende de cantidad de pantallas, sucursales, tipo de contenido y necesidades de soporte. Cotizamos segun tu escenario real.",
  },
  {
    question: "Hay planes para pymes?",
    answer: "Si. Tenemos propuestas para comercios pequenos y para operaciones que escalan a varias sucursales.",
  },
  {
    question: "La cotizacion incluye implementacion?",
    answer: "Podemos incluir implementacion, configuracion inicial y acompanamiento segun el alcance que necesites.",
  },
];

export function buildFaqServiceJsonLd(input: FaqServiceJsonLdInput) {
  const {
    serviceName,
    serviceType,
    siteUrl,
    pageUrl,
    faqs,
    offersUrl,
    areaServed = ["CABA", "GBA", "Buenos Aires"],
  } = input;

  const serviceNode: Record<string, unknown> = {
    "@type": "Service",
    name: serviceName,
    provider: { "@type": "Organization", name: "Expanded Signage", url: siteUrl },
    areaServed,
    url: pageUrl,
    serviceType,
  };
  if (offersUrl) {
    serviceNode.offers = {
      "@type": "Offer",
      url: offersUrl,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      serviceNode,
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}

export function buildHomePageJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Expanded Signage",
        url: siteUrl,
        email: "contacto@expandedsignage.com",
        areaServed: ["CABA", "GBA", "Buenos Aires"],
        makesOffer: {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Carteleria Digital para Comercios y Pymes",
          },
        },
      },
      {
        "@type": "Service",
        serviceType: "Carteleria digital",
        provider: {
          "@type": "Organization",
          name: "Expanded Signage",
        },
        areaServed: ["CABA", "GBA"],
        audience: {
          "@type": "BusinessAudience",
          audienceType: "Pymes de retail y franquicias",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Para que tipo de negocio sirve?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Expanded Signage esta pensado para pymes de retail, franquicias y comercios que necesitan actualizar contenido en pantallas en minutos.",
            },
          },
          {
            "@type": "Question",
            name: "Funciona en CABA y GBA?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Si. Brindamos implementacion y soporte para negocios de CABA y GBA.",
            },
          },
          {
            "@type": "Question",
            name: "Puedo pedir una cotizacion personalizada?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Si. Podes solicitar una cotizacion indicando rubro, cantidad de pantallas y sucursales.",
            },
          },
        ],
      },
    ],
  };
}

export function buildResourceArticleJsonLd(resource: ResourceArticle, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: resource.title,
        description: resource.description,
        dateModified: resource.updatedAt,
        author: {
          "@type": "Organization",
          name: "Expanded Signage",
        },
        publisher: {
          "@type": "Organization",
          name: "Expanded Signage",
          url: siteUrl,
        },
        mainEntityOfPage: `${siteUrl}/recursos/${resource.slug}`,
        keywords: resource.keywords.join(", "),
      },
      {
        "@type": "FAQPage",
        mainEntity: resource.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

export function getAllMarketingJsonLdInlineScripts(siteUrl = resolveMarketingSiteUrl()) {
  const staticScripts = [
    serializeJsonLd(buildHomePageJsonLd(siteUrl)),
    serializeJsonLd(
      buildFaqServiceJsonLd({
        serviceName: "Carteleria digital en Buenos Aires",
        siteUrl,
        pageUrl: `${siteUrl}/carteleria-digital-buenos-aires`,
        serviceType: "Carteleria digital para comercios y pymes",
        faqs: buenosAiresIntentFaqs,
        areaServed: ["Buenos Aires", "CABA", "GBA"],
        offersUrl: `${siteUrl}/cotizacion-carteleria-digital`,
      })
    ),
    serializeJsonLd(
      buildFaqServiceJsonLd({
        serviceName: "Carteleria digital para retail",
        siteUrl,
        pageUrl: `${siteUrl}/carteleria-digital-retail`,
        serviceType: "Carteleria digital para tiendas y comercios minoristas",
        faqs: retailIntentFaqs,
      })
    ),
    serializeJsonLd(
      buildFaqServiceJsonLd({
        serviceName: "Carteleria digital para franquicias",
        siteUrl,
        pageUrl: `${siteUrl}/carteleria-digital-franquicias`,
        serviceType: "Software y operacion de carteleria digital para franquicias",
        faqs: franquiciasIntentFaqs,
      })
    ),
    serializeJsonLd(
      buildFaqServiceJsonLd({
        serviceName: "Menu digital para restaurantes",
        siteUrl,
        pageUrl: `${siteUrl}/menu-digital-para-restaurantes`,
        serviceType: "Pantallas de menu digital para gastronomia",
        faqs: menuRestaurantesIntentFaqs,
      })
    ),
    serializeJsonLd(
      buildFaqServiceJsonLd({
        serviceName: "Precios de carteleria digital",
        siteUrl,
        pageUrl: `${siteUrl}/precios-carteleria-digital`,
        serviceType: "Cotizacion de carteleria digital para pymes y franquicias",
        faqs: preciosIntentFaqs,
      })
    ),
  ];

  const resourceScripts = seoResources.map((resource) =>
    serializeJsonLd(buildResourceArticleJsonLd(resource, siteUrl))
  );

  return [...staticScripts, ...resourceScripts];
}
