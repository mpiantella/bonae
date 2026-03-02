export const es = {
  lang: 'es',
  siteName: 'NOBAM',
  siteTagline: 'Servicios Digitales',
  metaDescription:
    'NOBAM ofrece servicios digitales de alta calidad para empresas venezolanas: software a medida, CRM, marketing digital y consultoría IT con metodología PMI.',

  nav: {
    services: 'Servicios',
    team: 'Equipo',
    contact: 'Contacto',
    langSwitch: 'EN',
    langSwitchHref: '/en/',
  },

  hero: {
    badge: 'Tecnología que funciona en Venezuela',
    headline: 'Transformamos tu negocio con soluciones digitales confiables',
    subheadline:
      'Combinamos 15 años de experiencia en tecnología financiera, gestión de proyectos PMI y visión emprendedora para ofrecerte servicios digitales adaptados a la realidad venezolana.',
    cta: 'Escríbenos por WhatsApp',
    ctaSub: 'Te respondemos el mismo día',
  },

  services: {
    sectionBadge: 'Catálogo de Servicios',
    title: 'Lo que podemos hacer por ti',
    subtitle:
      'Soluciones diseñadas para el mercado venezolano, con tecnología de nivel internacional y precios adaptados a nuestra realidad.',
    items: [
      {
        icon: 'crm',
        title: 'SaaS / CRM para PYMEs',
        description:
          'Herramientas en la nube para gestionar clientes, ventas y operaciones. Diseñadas para restaurantes, comercios y pequeñas empresas. Funciona con conexión lenta y tiene modo sin conexión.',
        tags: ['Gestión de clientes', 'Pipeline de ventas', 'Facturación', 'Reportes'],
      },
      {
        icon: 'marketing',
        title: 'Marketing Digital',
        description:
          'Estrategia y gestión de redes sociales, creación de contenido, publicidad digital en Instagram, TikTok y WhatsApp. Alcanza a tus clientes donde ya están.',
        tags: ['Redes sociales', 'Contenido', 'Publicidad digital', 'WhatsApp Business'],
      },
      {
        icon: 'code',
        title: 'Desarrollo de Software',
        description:
          'Aplicaciones web y móviles a medida, integraciones de sistemas y automatización de procesos. Calidad de ingeniería financiera internacional, construida para el contexto local.',
        tags: ['Web apps', 'Apps móviles', 'Integraciones', 'Automatización'],
      },
      {
        icon: 'consulting',
        title: 'Consultoría IT y Gestión de Proyectos',
        description:
          'Asesoría tecnológica y dirección de proyectos con metodología PMI. Llevamos tus iniciativas digitales del concepto a la entrega con disciplina, transparencia y resultados medibles.',
        tags: ['PMI certificado', 'Arquitectura IT', 'Transformación digital', 'Auditoría'],
      },
    ],
  },

  team: {
    sectionBadge: 'Quiénes somos',
    title: 'Un equipo con experiencia real',
    subtitle:
      'Somos tres hermanas venezolanas con trayectorias distintas y un objetivo común: construir soluciones digitales que funcionen de verdad.',
    members: [
      {
        initials: 'IS',
        role: 'Ingeniera de Software',
        bio: '15 años de experiencia en la industria de servicios financieros. Experta en arquitectura de sistemas, desarrollo backend y estándares de calidad empresarial aplicados a la realidad venezolana.',
        highlights: ['15 años en fintech', 'Arquitectura de sistemas', 'Calidad empresarial'],
      },
      {
        initials: 'IE',
        role: 'Ingeniera de Sistemas · PMP',
        bio: 'Ingeniera de Sistemas con certificación PMP del PMI Institute. Especializada en gestión de proyectos tecnológicos, planificación estratégica y entrega de resultados bajo metodologías internacionales.',
        highlights: ['PMP certificada', 'Gestión de proyectos', 'PMI Institute'],
      },
      {
        initials: 'TH',
        role: 'Emprendedora · Turismo y Hospitalidad',
        bio: 'Profesional en Turismo y Hospitalidad con espíritu emprendedor. Aporta visión de negocio, orientación al cliente y experiencia práctica construyendo y operando empresas de servicio en Venezuela.',
        highlights: ['Visión de negocio', 'Orientación al cliente', 'Emprendimiento local'],
      },
    ],
  },

  whyUs: {
    sectionBadge: 'Por qué elegirnos',
    title: 'Construido para Venezuela',
    subtitle:
      'No somos una consultora extranjera. Vivimos los mismos desafíos que tus clientes y diseñamos para ellos.',
    items: [
      {
        icon: 'signal',
        title: 'Optimizado para baja conectividad',
        description:
          'Nuestras soluciones funcionan en redes 3G y tienen modo sin conexión para los cortes de luz y de internet.',
      },
      {
        icon: 'shield',
        title: 'Calidad de nivel financiero',
        description:
          'Aplicamos los estándares de ingeniería de la industria financiera internacional a cada proyecto que desarrollamos.',
      },
      {
        icon: 'chart',
        title: 'Entrega con metodología PMI',
        description:
          'Proyectos planificados, ejecutados y entregados con disciplina certificada. Sin sorpresas, con resultados medibles.',
      },
      {
        icon: 'local',
        title: 'Conocimiento del mercado local',
        description:
          'Entendemos los métodos de pago venezolanos (USDT, Zelle, Zinli, Pago Móvil) y los integramos desde el día uno.',
      },
    ],
  },

  contact: {
    sectionBadge: 'Contacto',
    title: '¿Listo para empezar?',
    subtitle: 'Cuéntanos tu proyecto. Te respondemos el mismo día.',
    whatsappText: 'Escríbenos por WhatsApp',
    whatsappMessage: 'Hola NOBAM, me gustaría conocer más sobre sus servicios.',
    emailText: 'O escríbenos a',
    email: 'hola@nobam.ve',
  },

  footer: {
    tagline: 'Servicios digitales para el Venezuela de hoy.',
    links: ['Servicios', 'Equipo', 'Contacto'],
    copyright: '© 2025 NOBAM. Todos los derechos reservados.',
  },
} as const;

export type Translations = typeof es;
