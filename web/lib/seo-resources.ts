export type ResourceFaq = {
    question: string;
    answer: string;
};

export type ResourceSection = {
    title: string;
    paragraphs: string[];
    bullets?: string[];
};

export type ResourceArticle = {
    slug: string;
    title: string;
    description: string;
    category: "Costos" | "Implementacion" | "Franquicias" | "Contenido" | "Medicion";
    readTime: string;
    updatedAt: string;
    keywords: string[];
    intro: string;
    sections: ResourceSection[];
    faqs: ResourceFaq[];
};

export const seoResources: ResourceArticle[] = [
    {
        slug: "costos-carteleria-digital-pymes",
        title: "Costos de carteleria digital para pymes: guia practica para decidir mejor",
        description: "Como estimar costos reales de carteleria digital para pymes en CABA y GBA sin subestimar implementacion, operacion y soporte.",
        category: "Costos",
        readTime: "7 min",
        updatedAt: "2026-02-21",
        keywords: [
            "costos carteleria digital pymes",
            "precio carteleria digital argentina",
            "cotizacion carteleria digital",
        ],
        intro: "Cuando una pyme evalua carteleria digital, el error mas frecuente es comparar solo el precio del software. Para decidir bien, conviene separar costos de implementacion, operacion y soporte.",
        sections: [
            {
                title: "Que costos considerar antes de pedir cotizacion",
                paragraphs: [
                    "La inversion total se compone de plataforma, hardware, instalacion y tiempo operativo del equipo comercial o de marketing.",
                    "Si no se contemplan esos frentes desde el inicio, el proyecto parece barato al principio y caro al escalar a varias pantallas.",
                ],
                bullets: [
                    "Licencia o suscripcion de software.",
                    "Reproductores y pantallas compatibles.",
                    "Configuracion inicial y pruebas.",
                    "Soporte y mantenimiento continuo.",
                ],
            },
            {
                title: "Como estimar costo mensual por sucursal",
                paragraphs: [
                    "Una forma simple es calcular costo por pantalla y luego sumar horas operativas ahorradas por centralizar cambios.",
                    "En retail y franquicias, la estandarizacion suele reducir errores y acelerar campañas, lo que mejora el retorno.",
                ],
                bullets: [
                    "Definir cantidad de pantallas por local.",
                    "Calcular frecuencia de cambios de contenido.",
                    "Asignar valor economico al tiempo ahorrado.",
                    "Incluir contingencia para crecimiento.",
                ],
            },
            {
                title: "Buenas practicas para evitar sobrecostos",
                paragraphs: [
                    "Conviene empezar con una arquitectura de contenido y permisos clara para no rehacer configuraciones en cada nueva sucursal.",
                    "Tambien es clave elegir una plataforma facil de usar para evitar dependencia constante de perfiles tecnicos.",
                ],
            },
        ],
        faqs: [
            {
                question: "Conviene arrancar con pocas pantallas y luego escalar?",
                answer: "Si. Un piloto controlado permite validar operacion y retorno antes de expandir a toda la red.",
            },
            {
                question: "El costo mas importante es el software?",
                answer: "No siempre. Muchas veces el costo operativo y la falta de proceso generan mas impacto que la licencia.",
            },
        ],
    },
    {
        slug: "implementar-carteleria-digital-multiples-sucursales",
        title: "Como implementar carteleria digital en multiples sucursales sin perder control",
        description: "Checklist operativo para implementar carteleria digital en varias sucursales de retail o franquicias sin friccion.",
        category: "Implementacion",
        readTime: "8 min",
        updatedAt: "2026-02-21",
        keywords: [
            "implementar carteleria digital multiples sucursales",
            "gestion remota pantallas",
            "carteleria digital franquicias",
        ],
        intro: "Escalar carteleria digital a varias sucursales requiere procesos, no solo tecnologia. El objetivo es que cada local ejecute igual de bien sin perder velocidad comercial.",
        sections: [
            {
                title: "Definir estandar antes de desplegar",
                paragraphs: [
                    "Antes de instalar, conviene documentar formatos de contenido, horarios de publicacion y responsables por rol.",
                    "Con ese estandar, el alta de nuevas sucursales se vuelve repetible y medible.",
                ],
                bullets: [
                    "Plantillas visuales por tipo de campana.",
                    "Reglas de naming para piezas y playlists.",
                    "Permisos por equipo (marketing, operaciones, local).",
                ],
            },
            {
                title: "Plan de despliegue por etapas",
                paragraphs: [
                    "El despliegue mas estable es por olas: piloto, ajuste y expansion.",
                    "Cada etapa debe tener indicadores simples como disponibilidad de pantallas y tiempo de actualizacion.",
                ],
                bullets: [
                    "Etapa 1: 1 o 2 sucursales piloto.",
                    "Etapa 2: estandarizacion de procesos.",
                    "Etapa 3: expansion al resto de la red.",
                ],
            },
            {
                title: "Operacion diaria despues del lanzamiento",
                paragraphs: [
                    "La calidad operativa depende de monitoreo, alertas y rutinas semanales de revision de contenidos.",
                    "Una plataforma simple reduce friccion y permite que el equipo comercial actue rapido ante cambios.",
                ],
            },
        ],
        faqs: [
            {
                question: "Cuanto tarda un despliegue multi sucursal?",
                answer: "Depende de la cantidad de locales, pero con un piloto bien armado el escalado es mas rapido y predecible.",
            },
            {
                question: "Se puede delegar contenido por sucursal?",
                answer: "Si. Lo ideal es combinar lineamientos centrales con permisos locales para casos puntuales.",
            },
        ],
    },
    {
        slug: "errores-carteleria-digital-franquicias",
        title: "Errores comunes de carteleria digital en franquicias y como evitarlos",
        description: "Los errores mas frecuentes al gestionar carteleria digital en franquicias y un plan simple para corregirlos.",
        category: "Franquicias",
        readTime: "6 min",
        updatedAt: "2026-02-21",
        keywords: [
            "errores carteleria digital franquicias",
            "consistencia de marca sucursales",
            "gestion de pantallas franquicias",
        ],
        intro: "Muchas franquicias invierten en pantallas pero no logran consistencia real. El problema no suele ser la pantalla, sino la gobernanza del contenido.",
        sections: [
            {
                title: "Error 1: no definir un responsable claro",
                paragraphs: [
                    "Cuando todos pueden publicar sin lineamientos, la marca pierde coherencia entre sucursales.",
                    "La solucion es asignar dueños por tipo de contenido y proceso de aprobacion.",
                ],
            },
            {
                title: "Error 2: no separar contenido central y local",
                paragraphs: [
                    "Campanas nacionales y mensajes locales tienen objetivos distintos. Mezclarlos genera ruido.",
                    "Conviene reservar espacios para contenido corporativo y bloques para activaciones de cada sucursal.",
                ],
            },
            {
                title: "Error 3: no medir ejecucion",
                paragraphs: [
                    "Sin indicadores, es imposible saber si la red esta ejecutando igual.",
                    "Minimamente, hay que medir disponibilidad de pantallas, velocidad de cambios y cumplimiento de campañas.",
                ],
                bullets: [
                    "Disponibilidad por sucursal.",
                    "Tiempo medio de actualizacion.",
                    "Porcentaje de cumplimiento de campañas.",
                ],
            },
        ],
        faqs: [
            {
                question: "Como mantener consistencia sin frenar a las sucursales?",
                answer: "Con reglas centrales claras y espacios locales controlados. No es bloquear, es ordenar.",
            },
            {
                question: "Que indicador conviene mirar primero?",
                answer: "Disponibilidad de pantallas y cumplimiento de campanas son dos metricas iniciales de alto impacto.",
            },
        ],
    },
    {
        slug: "estrategia-contenido-pantallas-retail",
        title: "Estrategia de contenido para pantallas en retail: que publicar y cuando",
        description: "Guia para definir una estrategia de contenido efectiva en pantallas de retail segun momento del dia y objetivo comercial.",
        category: "Contenido",
        readTime: "7 min",
        updatedAt: "2026-02-21",
        keywords: [
            "contenido pantallas retail",
            "estrategia carteleria digital",
            "promociones en pantallas",
        ],
        intro: "No alcanza con tener pantallas activas. Para que vendan, necesitan una estrategia de contenido ligada al flujo real de clientes y a tus objetivos comerciales.",
        sections: [
            {
                title: "Mapear el recorrido del cliente en tienda",
                paragraphs: [
                    "Cada ubicacion de pantalla cumple un rol diferente: atraccion en vidriera, conversion cerca de caja o cross-sell en sectores internos.",
                    "Definir ese mapa evita repetir piezas sin sentido comercial.",
                ],
            },
            {
                title: "Organizar contenidos por objetivo",
                paragraphs: [
                    "Una grilla simple ayuda a equilibrar marca, oferta y accion.",
                ],
                bullets: [
                    "Atraccion: novedades, lanzamientos, alto impacto visual.",
                    "Conversion: precios, promos vigentes, combos.",
                    "Fidelizacion: beneficios, programas, mensajes de marca.",
                ],
            },
            {
                title: "Ajustar por horario y dia de semana",
                paragraphs: [
                    "La efectividad sube cuando el contenido cambia por franja horaria y comportamiento real de compra.",
                    "En lugar de una playlist fija, conviene usar bloques por contexto comercial.",
                ],
            },
        ],
        faqs: [
            {
                question: "Cada cuanto conviene actualizar la grilla?",
                answer: "Como base semanal, con cambios puntuales diarios en promociones y disponibilidad.",
            },
            {
                question: "Es mejor video o imagen fija?",
                answer: "Depende del objetivo. Para ofertas rapidas, piezas simples y claras suelen convertir mejor.",
            },
        ],
    },
    {
        slug: "medir-roi-carteleria-digital",
        title: "Como medir el ROI de carteleria digital en comercios y franquicias",
        description: "Metricas y metodologia para medir retorno real de carteleria digital y optimizar decisiones comerciales.",
        category: "Medicion",
        readTime: "8 min",
        updatedAt: "2026-02-21",
        keywords: [
            "medir roi carteleria digital",
            "kpis carteleria digital",
            "retorno pantallas en tienda",
        ],
        intro: "Medir ROI evita que carteleria digital se perciba como gasto. Con un marco simple de KPIs, se puede demostrar impacto comercial y priorizar mejoras.",
        sections: [
            {
                title: "Definir una linea base antes del despliegue",
                paragraphs: [
                    "Sin comparacion antes/despues no hay ROI confiable. Por eso hay que tomar una foto inicial de indicadores clave.",
                ],
                bullets: [
                    "Ventas por categoria promocionada.",
                    "Tiempo de implementacion de campañas.",
                    "Errores de precios o promociones vencidas.",
                ],
            },
            {
                title: "Separar KPIs operativos y comerciales",
                paragraphs: [
                    "Los KPIs operativos muestran eficiencia del equipo; los comerciales muestran impacto en negocio.",
                    "Los dos grupos son necesarios para una decision completa.",
                ],
                bullets: [
                    "Operativos: tiempo de publicacion, disponibilidad, cumplimiento.",
                    "Comerciales: uplift de ventas, ticket promedio, conversion en puntos clave.",
                ],
            },
            {
                title: "Iterar con ciclos cortos",
                paragraphs: [
                    "Con revisiones semanales o quincenales se detectan oportunidades rapido y se ajusta contenido con menos riesgo.",
                    "Ese ciclo continuo es el que convierte una instalacion en una ventaja competitiva.",
                ],
            },
        ],
        faqs: [
            {
                question: "En cuanto tiempo se puede medir impacto?",
                answer: "En pocas semanas ya se pueden observar mejoras operativas; el impacto comercial suele consolidarse en 1 a 3 meses.",
            },
            {
                question: "Que KPI conviene priorizar al principio?",
                answer: "Tiempo de actualizacion y cumplimiento de campañas son dos indicadores iniciales muy utiles.",
            },
        ],
    },
];

export function getSeoResourceBySlug(slug: string) {
    return seoResources.find((item) => item.slug === slug);
}
