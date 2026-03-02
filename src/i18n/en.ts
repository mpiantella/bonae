import type { Translations } from './es';

export const en: Translations = {
  lang: 'en',
  siteName: 'NOBAM',
  siteTagline: 'Digital Services',
  metaDescription:
    'NOBAM delivers high-quality digital services for Venezuelan businesses: custom software, CRM tools, digital marketing, and PMI-certified IT consulting.',

  nav: {
    services: 'Services',
    team: 'Team',
    contact: 'Contact',
    langSwitch: 'ES',
    langSwitchHref: '/',
  },

  hero: {
    badge: 'Technology that works in Venezuela',
    headline: 'Digital services built for Venezuela\'s real world',
    subheadline:
      'We combine 15 years of financial technology experience, PMI project management, and entrepreneurial vision to deliver digital solutions adapted to Venezuela\'s reality.',
    cta: 'Chat with us on WhatsApp',
    ctaSub: 'We respond the same day',
  },

  services: {
    sectionBadge: 'Service Catalog',
    title: 'What we can do for you',
    subtitle:
      'Solutions designed for the Venezuelan market, built with international-grade technology and pricing adapted to local realities.',
    items: [
      {
        icon: 'crm',
        title: 'SaaS / CRM for SMEs',
        description:
          'Cloud tools to manage clients, sales, and operations. Designed for restaurants, retail, and small businesses. Works on slow connections and has an offline mode.',
        tags: ['Client management', 'Sales pipeline', 'Invoicing', 'Reports'],
      },
      {
        icon: 'marketing',
        title: 'Digital Marketing',
        description:
          'Social media strategy and management, content creation, digital advertising on Instagram, TikTok, and WhatsApp. Reach your customers where they already are.',
        tags: ['Social media', 'Content', 'Digital ads', 'WhatsApp Business'],
      },
      {
        icon: 'code',
        title: 'Software Development',
        description:
          'Custom web and mobile apps, system integrations, and process automation. International financial-grade engineering quality, built for the local context.',
        tags: ['Web apps', 'Mobile apps', 'Integrations', 'Automation'],
      },
      {
        icon: 'consulting',
        title: 'IT Consulting & Project Management',
        description:
          'Technology advisory and project delivery using PMI methodology. We take your digital initiatives from concept to launch with discipline, transparency, and measurable results.',
        tags: ['PMI certified', 'IT architecture', 'Digital transformation', 'Audit'],
      },
    ],
  },

  team: {
    sectionBadge: 'Who we are',
    title: 'A team with real experience',
    subtitle:
      'We are three Venezuelan sisters with different backgrounds and one shared goal: building digital solutions that actually work.',
    members: [
      {
        initials: 'SE',
        role: 'Software Engineer',
        bio: '15 years of experience in the financial services industry. Expert in systems architecture, backend development, and enterprise-grade quality standards applied to the Venezuelan market.',
        highlights: ['15 years in fintech', 'Systems architecture', 'Enterprise quality'],
      },
      {
        initials: 'SE',
        role: 'Systems Engineer · PMP',
        bio: 'Systems Engineer with a PMP certification from the PMI Institute. Specialized in technology project management, strategic planning, and delivering results under international methodologies.',
        highlights: ['PMP certified', 'Project management', 'PMI Institute'],
      },
      {
        initials: 'TH',
        role: 'Entrepreneur · Tourism & Hospitality',
        bio: 'Tourism and Hospitality professional with an entrepreneurial spirit. Brings business vision, customer focus, and hands-on experience building and operating service businesses in Venezuela.',
        highlights: ['Business vision', 'Customer focus', 'Local entrepreneurship'],
      },
    ],
  },

  whyUs: {
    sectionBadge: 'Why choose us',
    title: 'Built for Venezuela',
    subtitle:
      'We are not a foreign consultancy. We live the same challenges as your customers and we design for them.',
    items: [
      {
        icon: 'signal',
        title: 'Optimized for low connectivity',
        description:
          'Our solutions work on 3G networks and have an offline mode for power and internet outages.',
      },
      {
        icon: 'shield',
        title: 'Financial-grade quality',
        description:
          'We apply the engineering standards of the international financial industry to every project we build.',
      },
      {
        icon: 'chart',
        title: 'PMI-certified delivery',
        description:
          'Projects planned, executed, and delivered with certified discipline. No surprises — only measurable results.',
      },
      {
        icon: 'local',
        title: 'Local market knowledge',
        description:
          'We understand Venezuelan payment methods (USDT, Zelle, Zinli, Pago Móvil) and integrate them from day one.',
      },
    ],
  },

  contact: {
    sectionBadge: 'Contact',
    title: 'Ready to get started?',
    subtitle: 'Tell us about your project. We respond the same day.',
    whatsappText: 'Chat with us on WhatsApp',
    whatsappMessage: 'Hello NOBAM, I would like to learn more about your services.',
    emailText: 'Or email us at',
    email: 'hola@nobam.ve',
  },

  footer: {
    tagline: 'Digital services for Venezuela today.',
    links: ['Services', 'Team', 'Contact'],
    copyright: '© 2025 NOBAM. All rights reserved.',
  },
};
