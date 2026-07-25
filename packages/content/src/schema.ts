import { z } from 'zod';
import { valuePropIcons } from './icons.js';

export const localeSchema = z.enum(['es', 'en']);

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const weekdaySchema = z.enum(WEEKDAYS);

export type Weekday = z.infer<typeof weekdaySchema>;

export const businessHoursDaySchema = z
  .object({
    day: weekdaySchema,
    closed: z.boolean(),
    open: z.string(),
    close: z.string(),
  })
  .superRefine((day, ctx) => {
    if (day.closed) {
      return;
    }
    if (!day.open.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Open time is required when the day is open',
        path: ['open'],
      });
    }
    if (!day.close.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Close time is required when the day is open',
        path: ['close'],
      });
    }
  });

export const businessHoursSchema = z
  .object({
    title: z.string().min(1),
    days: z.array(businessHoursDaySchema).length(7),
  })
  .superRefine((hours, ctx) => {
    hours.days.forEach((day, index) => {
      if (day.day !== WEEKDAYS[index]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Day at index ${index} must be ${WEEKDAYS[index]}`,
          path: ['days', index, 'day'],
        });
      }
    });
  });

export type BusinessHours = z.infer<typeof businessHoursSchema>;
export type BusinessHoursDay = z.infer<typeof businessHoursDaySchema>;

const iconItemSchema = z.object({
  icon: z.enum(valuePropIcons),
  title: z.string().min(1),
  description: z.string().min(1).max(180),
  backLabel: z.string().min(1),
  backDescription: z.string().min(1).max(180),
});

const memberSchema = z.object({
  initials: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().min(1),
  highlights: z.array(z.string().min(1)).min(1),
});

const templateItemSchema = z
  .object({
    category: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1).max(220),
    detailDescription: z.string(),
    imageSrc: z.string(),
    slug: z.string(),
    demoUrl: z.string(),
    price: z.number().int().nonnegative(),
    features: z.array(z.string().min(1)).max(8),
    comingSoon: z.boolean(),
  })
  .superRefine((item, ctx) => {
    if (item.comingSoon) {
      return;
    }
    if (!item.slug.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slug is required for live templates',
        path: ['slug'],
      });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Slug must be lowercase kebab-case',
        path: ['slug'],
      });
    }
    if (!item.imageSrc.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Image is required for live templates',
        path: ['imageSrc'],
      });
    }
    if (!item.detailDescription.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Detail description is required for live templates',
        path: ['detailDescription'],
      });
    }
    if (item.price <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Price is required for live templates',
        path: ['price'],
      });
    }
    const demoUrl = item.demoUrl.trim();
    if (demoUrl && !/^https?:\/\/.+/i.test(demoUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Live page URL must be an absolute http(s) URL',
        path: ['demoUrl'],
      });
    }
  });

export const contentDocumentSchema = z.object({
  lang: localeSchema,
  siteName: z.string().min(1),
  siteTagline: z.string().min(1),
  metaDescription: z.string().min(1),

  nav: z.object({
    home: z.string().min(1),
    about: z.string().min(1),
    valueProp: z.string().min(1),
    templates: z.string().min(1),
    contact: z.string().min(1),
    cta: z.string().min(1),
    clients: z.string().min(1),
    team: z.string().min(1),
    langSwitch: z.string().min(1),
    langSwitchHref: z.string().min(1),
  }),

  hero: z.object({
    badge: z.string().min(1),
    headline: z.string().min(1),
    subheadline: z.string().min(1),
    cta: z.string().min(1),
    ctaSecondary: z.string().min(1),
    ctaSub: z.string().min(1),
  }),

  valueProp: z.object({
    sectionBadge: z.string().min(1),
    title: z.string().min(1),
    subheadline: z.string().min(1),
    items: z.array(iconItemSchema).min(1).max(8),
  }),

  keyFigures: z.object({
    years: z.string().min(1),
    yearsLabel: z.string().min(1),
    clients: z.string().min(1),
    clientsValue: z.string().min(1),
    projects: z.string().min(1),
    projectsValue: z.string().min(1),
    presence: z.string().min(1),
    presenceLabel: z.string().min(1),
    presenceValue: z.string().min(1),
    foundersCount: z.string().min(1),
    foundersLabel: z.string().min(1),
  }),

  about: z.object({
    sectionBadge: z.string().min(1),
    title: z.string().min(1),
    foundersTitle: z.string().min(1),
    members: z.array(memberSchema).length(3),
  }),

  templates: z.object({
    sectionBadge: z.string().min(1),
    title: z.string().min(1),
    subheadline: z.string().min(1),
    viewAllLabel: z.string().min(1),
    viewAllHref: z.string().min(1),
    viewDetailsLabel: z.string().min(1),
    backLabel: z.string().min(1),
    featuresLabel: z.string().min(1),
    priceCurrency: z.string().min(1),
    priceNote: z.string().min(1),
    useTemplateLabel: z.string().min(1),
    demoLabel: z.string().min(1),
    comingSoonModalBody: z.string().min(1),
    comingSoonModalDismiss: z.string().min(1),
    items: z.array(templateItemSchema).min(2).max(6),
  }),

  plans: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    cta: z.string().min(1),
  }),

  contact: z.object({
    sectionBadge: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    form: z.object({
      name: z.string().min(1),
      email: z.string().min(1),
      phone: z.string().min(1),
      business: z.string().min(1),
      serviceType: z.string().min(1),
      message: z.string().min(1),
      submit: z.string().min(1),
      serviceOptions: z.array(z.string().min(1)).min(1),
    }),
    whatsappText: z.string().min(1),
    whatsappMessage: z.string().min(1),
    emailText: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    hours: businessHoursSchema,
    location: z.string().min(1),
    locationNote: z.string().min(1),
  }),

  footer: z.object({
    tagline: z.string().min(1),
    description: z.string().min(1),
    nav: z.object({
      title: z.string().min(1),
      home: z.string().min(1),
      about: z.string().min(1),
      services: z.string().min(1),
      contact: z.string().min(1),
    }),
    services: z.object({
      title: z.string().min(1),
      web: z.string().min(1),
      social: z.string().min(1),
      crm: z.string().min(1),
      consulting: z.string().min(1),
    }),
    legal: z.object({
      privacy: z.string().min(1),
      terms: z.string().min(1),
      cookies: z.string().min(1),
    }),
    copyright: z.string().min(1),
  }),

  cookieBanner: z.object({
    message: z.string().min(1),
    accept: z.string().min(1),
    privacy: z.string().min(1),
    ariaLabel: z.string().min(1),
  }),
});

export const siteSettingsSchema = z.object({
  siteUrl: z.string().url(),
  whatsappNumber: z.string().regex(/^\d{10,15}$/),
  socialLinks: z.object({
    instagram: z.string(),
    facebook: z.string(),
    linkedin: z.string(),
  }),
  legalLinks: z.object({
    privacy: z.string(),
    terms: z.string(),
    cookies: z.string(),
  }),
});

export type ContentDocument = z.infer<typeof contentDocumentSchema>;
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type Locale = z.infer<typeof localeSchema>;

export function parseContentDocument(data: unknown): ContentDocument {
  return contentDocumentSchema.parse(data);
}

export function parseSiteSettings(data: unknown): SiteSettings {
  return siteSettingsSchema.parse(data);
}

/** Default Mon–Fri 09:00–18:00, Sat 09:00–13:00, Sun closed. */
export function defaultBusinessHoursDays(): BusinessHoursDay[] {
  return WEEKDAYS.map((day) => {
    if (day === 'sunday') {
      return { day, closed: true, open: '', close: '' };
    }
    if (day === 'saturday') {
      return { day, closed: false, open: '09:00', close: '13:00' };
    }
    return { day, closed: false, open: '09:00', close: '18:00' };
  });
}

/**
 * Narrow unknown contact.hours (e.g. legacy string or partial DO cache)
 * to the structured schedule shape. Returns null when out of sync.
 */
export function asBusinessHours(value: unknown): BusinessHours | null {
  const parsed = businessHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const WEEKDAY_LABELS: Record<Locale, Record<Weekday, string>> = {
  es: {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  },
  en: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
};
