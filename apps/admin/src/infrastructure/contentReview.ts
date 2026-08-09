import { checkLocaleParity } from '@bonae/content/validate';
import {
  asBusinessHours,
  parseContentDocument,
  parseSiteSettings,
  type ContentDocument,
  type SiteSettings,
} from '@bonae/content/schema';

export type ReviewChangeKind = 'changed' | 'added' | 'removed';

export interface ReviewFieldChange {
  locale: 'es' | 'en' | 'settings';
  label: string;
  kind: ReviewChangeKind;
  before?: string;
  after?: string;
}

export interface ReviewWarning {
  label: string;
  message: string;
}

export interface PublishReview {
  changes: ReviewFieldChange[];
  warnings: ReviewWarning[];
  validationErrors: string[];
  changeCount: number;
}

const SECTION_TITLES: Record<string, string> = {
  nav: 'Navegación',
  hero: 'Hero',
  valueProp: 'Servicios',
  keyFigures: 'DatosClave',
  about: 'Sobre nosotras',
  templates: 'Plantillas',
  plans: 'CTA',
  contact: 'Contacto',
  footer: 'Pie de página',
  cookieBanner: 'Banner de cookies',
};

const HERO_FIELDS: Record<string, string> = {
  badge: 'Insignia',
  headline: 'Titular',
  subheadline: 'Subtítulo',
  cta: 'Botón principal',
  ctaSecondary: 'Botón secundario',
  ctaSub: 'Nota de confianza',
};

const VALUE_PROP_FIELDS: Record<string, string> = {
  sectionBadge: 'Etiqueta de sección',
  title: 'Título',
  subheadline: 'Subtítulo',
};

const VALUE_PROP_ITEM_FIELDS: Record<string, string> = {
  icon: 'Icono',
  title: 'Título',
  description: 'Descripción',
  backLabel: 'Etiqueta reverso',
  backDescription: 'Descripción reverso',
};

const KEY_FIGURES_FIELDS: Record<string, string> = {
  years: 'Valor de años',
  yearsLabel: 'Etiqueta de años',
  clientsValue: 'Valor de clientes',
  clients: 'Etiqueta de clientes',
  projectsValue: 'Valor de proyectos',
  projects: 'Etiqueta de proyectos',
  presenceValue: 'Valor de presencia',
  presenceLabel: 'Etiqueta de presencia',
  presence: 'Etiqueta corta de presencia',
  foundersCount: 'Cantidad de fundadoras',
  foundersLabel: 'Etiqueta de fundadoras',
};

const TEMPLATES_FIELDS: Record<string, string> = {
  sectionBadge: 'Etiqueta de sección',
  title: 'Título',
  subheadline: 'Subtítulo',
  viewAllLabel: 'Texto Ver todas',
  viewAllHref: 'Enlace Ver todas',
  viewDetailsLabel: 'Ver detalles',
  backLabel: 'Volver',
  featuresLabel: 'Detalles técnicos',
  priceCurrency: 'Moneda',
  priceNote: 'Nota de precio',
  useTemplateLabel: 'Usar plantilla',
  demoLabel: 'Ver página en vivo',
  comingSoonModalBody: 'Modal próximamente',
  comingSoonModalDismiss: 'Cerrar modal',
};

const TEMPLATES_TRANSLATABLE_FIELDS: Record<string, string> = {
  sectionBadge: TEMPLATES_FIELDS.sectionBadge,
  title: TEMPLATES_FIELDS.title,
  subheadline: TEMPLATES_FIELDS.subheadline,
  viewAllLabel: TEMPLATES_FIELDS.viewAllLabel,
};

const TEMPLATES_ITEM_FIELDS: Record<string, string> = {
  category: 'Categoría',
  title: 'Título',
  description: 'Descripción',
  detailDescription: 'Descripción larga',
  imageSrc: 'Imagen',
  slug: 'Slug',
  demoUrl: 'URL página en vivo',
};

const TEMPLATES_TRANSLATABLE_ITEM_FIELDS: Record<string, string> = {
  category: TEMPLATES_ITEM_FIELDS.category,
  title: TEMPLATES_ITEM_FIELDS.title,
  description: TEMPLATES_ITEM_FIELDS.description,
};

const PLANS_FIELDS: Record<string, string> = {
  title: 'Título',
  subtitle: 'Subtítulo',
  cta: 'Texto del botón',
};

const CONTACT_FIELDS: Record<string, string> = {
  sectionBadge: 'Etiqueta de sección',
  title: 'Título',
  subtitle: 'Descripción',
  whatsappText: 'Texto de WhatsApp',
  whatsappMessage: 'Mensaje de WhatsApp',
  emailText: 'Texto de correo',
  email: 'Correo',
  phone: 'Teléfono',
  location: 'Ubicación',
  locationNote: 'Nota de ubicación',
};

const CONTACT_FORM_FIELDS: Record<string, string> = {
  name: 'Nombre completo',
  email: 'Correo electrónico',
  phone: 'Teléfono / WhatsApp',
  business: 'Nombre del negocio',
  serviceType: 'Tipo de servicio',
  message: 'Mensaje',
  submit: 'Texto del botón',
};

const TOP_LEVEL_STRING_FIELDS: Record<string, string> = {
  siteName: 'Nombre del sitio',
  siteTagline: 'Eslogan del sitio',
  metaDescription: 'Meta descripción',
};

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  siteUrl: 'URL del sitio',
  whatsappNumber: 'Número de WhatsApp',
  socialLinks: 'Redes sociales',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  legalLinks: 'Enlaces legales',
  privacy: 'Privacidad',
  terms: 'Términos',
  cookies: 'Cookies',
};

function truncate(value: string, max = 140): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

function humanizeSegment(segment: string): string {
  return (
    SETTINGS_FIELD_LABELS[segment] ??
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/([A-Z])/g, ' $1')
  );
}

function formatChangeLabel(locale: ReviewFieldChange['locale'], ...segments: string[]): string {
  const prefix = locale === 'settings' ? 'Configuración' : locale.toUpperCase();
  return [prefix, ...segments].join(' › ');
}

function pushStringChange(
  changes: ReviewFieldChange[],
  locale: ReviewFieldChange['locale'],
  label: string,
  before: string,
  after: string,
): void {
  if (before === after) {
    return;
  }
  changes.push({
    locale,
    label,
    kind: 'changed',
    before: truncate(before),
    after: truncate(after),
  });
}

function diffRecordStrings(
  changes: ReviewFieldChange[],
  locale: ReviewFieldChange['locale'],
  sectionTitle: string,
  fieldLabels: Record<string, string>,
  draft: Record<string, unknown>,
  published: Record<string, unknown>,
): void {
  for (const [field, fieldLabel] of Object.entries(fieldLabels)) {
    const before = published[field];
    const after = draft[field];
    if (typeof before !== 'string' || typeof after !== 'string') {
      continue;
    }
    pushStringChange(changes, locale, formatChangeLabel(locale, sectionTitle, fieldLabel), before, after);
  }
}

function diffTemplatesItems(
  changes: ReviewFieldChange[],
  locale: 'es' | 'en',
  draft: ContentDocument,
  published: ContentDocument,
): void {
  const draftItems = draft.templates.items;
  const publishedItems = published.templates.items;

  for (let i = 0; i < draftItems.length; i++) {
    const draftItem = draftItems[i];
    const publishedItem = publishedItems[i];

    if (!publishedItem) {
      for (const [field, fieldLabel] of Object.entries(TEMPLATES_ITEM_FIELDS)) {
        const value = draftItem[field as keyof typeof draftItem];
        if (typeof value !== 'string') {
          continue;
        }
        changes.push({
          locale,
          label: formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, fieldLabel),
          kind: 'added',
          after: truncate(value),
        });
      }
      if (draftItem.price > 0) {
        changes.push({
          locale,
          label: formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, 'Precio'),
          kind: 'added',
          after: String(draftItem.price),
        });
      }
      if (draftItem.comingSoon) {
        changes.push({
          locale,
          label: formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, 'Próximamente'),
          kind: 'added',
          after: 'sí',
        });
      }
      continue;
    }

    for (const [field, fieldLabel] of Object.entries(TEMPLATES_ITEM_FIELDS)) {
      const before = publishedItem[field as keyof typeof publishedItem];
      const after = draftItem[field as keyof typeof draftItem];
      if (typeof before !== 'string' || typeof after !== 'string') {
        continue;
      }
      pushStringChange(
        changes,
        locale,
        formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, fieldLabel),
        before,
        after,
      );
    }
    if (draftItem.price !== publishedItem.price) {
      changes.push({
        locale,
        label: formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, 'Precio'),
        kind: 'changed',
        before: String(publishedItem.price),
        after: String(draftItem.price),
      });
    }
    if (draftItem.comingSoon !== publishedItem.comingSoon) {
      changes.push({
        locale,
        label: formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, 'Próximamente'),
        kind: 'changed',
        before: publishedItem.comingSoon ? 'sí' : 'no',
        after: draftItem.comingSoon ? 'sí' : 'no',
      });
    }

    const draftFeatures = draftItem.features.join(' · ');
    const publishedFeatures = publishedItem.features.join(' · ');
    pushStringChange(
      changes,
      locale,
      formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`, 'Detalles técnicos'),
      publishedFeatures,
      draftFeatures,
    );
  }

  for (let i = draftItems.length; i < publishedItems.length; i++) {
    const publishedItem = publishedItems[i];
    changes.push({
      locale,
      label: formatChangeLabel(locale, SECTION_TITLES.templates, `Ítem ${i + 1}`),
      kind: 'removed',
      before: truncate(publishedItem.title),
    });
  }
}

function diffValuePropItems(
  changes: ReviewFieldChange[],
  locale: 'es' | 'en',
  draft: ContentDocument,
  published: ContentDocument,
): void {
  const draftItems = draft.valueProp.items;
  const publishedItems = published.valueProp.items;

  for (let i = 0; i < draftItems.length; i++) {
    const draftItem = draftItems[i];
    const publishedItem = publishedItems[i];

    if (!publishedItem) {
      for (const [field, fieldLabel] of Object.entries(VALUE_PROP_ITEM_FIELDS)) {
        const value = draftItem[field as keyof typeof draftItem];
        if (typeof value !== 'string') {
          continue;
        }
        changes.push({
          locale,
          label: formatChangeLabel(locale, SECTION_TITLES.valueProp, `Ítem ${i + 1}`, fieldLabel),
          kind: 'added',
          after: truncate(value),
        });
      }
      continue;
    }

    for (const [field, fieldLabel] of Object.entries(VALUE_PROP_ITEM_FIELDS)) {
      const before = publishedItem[field as keyof typeof publishedItem];
      const after = draftItem[field as keyof typeof draftItem];
      if (typeof before !== 'string' || typeof after !== 'string') {
        continue;
      }
      pushStringChange(
        changes,
        locale,
        formatChangeLabel(locale, SECTION_TITLES.valueProp, `Ítem ${i + 1}`, fieldLabel),
        before,
        after,
      );
    }
  }

  for (let i = draftItems.length; i < publishedItems.length; i++) {
    const publishedItem = publishedItems[i];
    const labelParts = Object.entries(VALUE_PROP_ITEM_FIELDS)
      .map(([field, fieldLabel]) => {
        const value = publishedItem[field as keyof typeof publishedItem];
        return typeof value === 'string' ? `${fieldLabel}: ${truncate(value, 60)}` : null;
      })
      .filter(Boolean);
    changes.push({
      locale,
      label: formatChangeLabel(locale, SECTION_TITLES.valueProp, `Ítem ${i + 1}`),
      kind: 'removed',
      before: labelParts.join(' · ') || 'Elemento eliminado',
    });
  }
}

function diffContactForm(
  changes: ReviewFieldChange[],
  locale: 'es' | 'en',
  draft: ContentDocument,
  published: ContentDocument,
): void {
  const sectionTitle = SECTION_TITLES.contact;
  diffRecordStrings(
    changes,
    locale,
    `${sectionTitle} › Formulario`,
    CONTACT_FORM_FIELDS,
    draft.contact.form as unknown as Record<string, unknown>,
    published.contact.form as unknown as Record<string, unknown>,
  );

  const draftOptions = draft.contact.form.serviceOptions;
  const publishedOptions = published.contact.form.serviceOptions;

  for (let i = 0; i < draftOptions.length; i++) {
    const after = draftOptions[i];
    const before = publishedOptions[i];
    if (before === undefined) {
      changes.push({
        locale,
        label: formatChangeLabel(locale, sectionTitle, 'Opción de servicio', `${i + 1}`),
        kind: 'added',
        after: truncate(after),
      });
      continue;
    }
    pushStringChange(
      changes,
      locale,
      formatChangeLabel(locale, sectionTitle, 'Opción de servicio', `${i + 1}`),
      before,
      after,
    );
  }

  for (let i = draftOptions.length; i < publishedOptions.length; i++) {
    changes.push({
      locale,
      label: formatChangeLabel(locale, sectionTitle, 'Opción de servicio', `${i + 1}`),
      kind: 'removed',
      before: truncate(publishedOptions[i]),
    });
  }
}

function formatHoursDay(day: { closed: boolean; open: string; close: string }): string {
  if (day.closed) {
    return 'Cerrado';
  }
  return `${day.open}–${day.close}`;
}

function summarizeHoursValue(value: unknown): string {
  const hours = asBusinessHours(value);
  if (hours) {
    return `${hours.title}: ${hours.days.map(formatHoursDay).join(', ')}`;
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (value == null) {
    return '(ausente)';
  }
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return '(inválido)';
  }
}

function diffContactHours(
  changes: ReviewFieldChange[],
  locale: 'es' | 'en',
  draft: ContentDocument,
  published: ContentDocument,
): void {
  const sectionTitle = SECTION_TITLES.contact;
  const draftHours = asBusinessHours(draft.contact?.hours);
  const publishedHours = asBusinessHours(published.contact?.hours);

  // Legacy string hours / missing days / partial DO cache — never throw; show one opaque diff.
  if (!draftHours || !publishedHours) {
    pushStringChange(
      changes,
      locale,
      formatChangeLabel(locale, sectionTitle, 'Horario'),
      summarizeHoursValue(published.contact?.hours),
      summarizeHoursValue(draft.contact?.hours),
    );
    return;
  }

  pushStringChange(
    changes,
    locale,
    formatChangeLabel(locale, sectionTitle, 'Horario', 'Título'),
    publishedHours.title,
    draftHours.title,
  );

  const dayLabels: Record<string, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  draftHours.days.forEach((draftDay, index) => {
    const publishedDay = publishedHours.days[index];
    if (!publishedDay) {
      return;
    }
    const before = formatHoursDay(publishedDay);
    const after = formatHoursDay(draftDay);
    pushStringChange(
      changes,
      locale,
      formatChangeLabel(locale, sectionTitle, 'Horario', dayLabels[draftDay.day] ?? draftDay.day),
      before,
      after,
    );
  });
}

function diffLocaleDocument(
  locale: 'es' | 'en',
  draft: ContentDocument,
  published: ContentDocument,
): ReviewFieldChange[] {
  const changes: ReviewFieldChange[] = [];

  diffRecordStrings(changes, locale, 'Documento', TOP_LEVEL_STRING_FIELDS, draft, published);

  for (const [sectionKey, sectionTitle] of Object.entries(SECTION_TITLES)) {
    const draftSection = draft[sectionKey as keyof ContentDocument];
    const publishedSection = published[sectionKey as keyof ContentDocument];
    if (
      typeof draftSection !== 'object' ||
      draftSection === null ||
      typeof publishedSection !== 'object' ||
      publishedSection === null
    ) {
      continue;
    }

    if (sectionKey === 'hero') {
      diffRecordStrings(
        changes,
        locale,
        sectionTitle,
        HERO_FIELDS,
        draftSection as Record<string, unknown>,
        publishedSection as Record<string, unknown>,
      );
      continue;
    }

    if (sectionKey === 'valueProp') {
      diffRecordStrings(
        changes,
        locale,
        sectionTitle,
        VALUE_PROP_FIELDS,
        draftSection as Record<string, unknown>,
        publishedSection as Record<string, unknown>,
      );
      diffValuePropItems(changes, locale, draft, published);
      continue;
    }

    if (sectionKey === 'keyFigures') {
      diffRecordStrings(
        changes,
        locale,
        sectionTitle,
        KEY_FIGURES_FIELDS,
        draftSection as Record<string, unknown>,
        publishedSection as Record<string, unknown>,
      );
      continue;
    }

    if (sectionKey === 'templates') {
      diffRecordStrings(
        changes,
        locale,
        sectionTitle,
        TEMPLATES_FIELDS,
        draftSection as Record<string, unknown>,
        publishedSection as Record<string, unknown>,
      );
      diffTemplatesItems(changes, locale, draft, published);
      continue;
    }

    if (sectionKey === 'plans') {
      diffRecordStrings(
        changes,
        locale,
        sectionTitle,
        PLANS_FIELDS,
        draftSection as Record<string, unknown>,
        publishedSection as Record<string, unknown>,
      );
      continue;
    }

    if (sectionKey === 'contact') {
      diffRecordStrings(
        changes,
        locale,
        sectionTitle,
        CONTACT_FIELDS,
        draftSection as Record<string, unknown>,
        publishedSection as Record<string, unknown>,
      );
      diffContactForm(changes, locale, draft, published);
      diffContactHours(changes, locale, draft, published);
      continue;
    }

    if (JSON.stringify(draftSection) !== JSON.stringify(publishedSection)) {
      changes.push({
        locale,
        label: formatChangeLabel(locale, sectionTitle),
        kind: 'changed',
        before: truncate(JSON.stringify(publishedSection)),
        after: truncate(JSON.stringify(draftSection)),
      });
    }
  }

  return changes;
}

function diffSettings(draft: SiteSettings, published: SiteSettings): ReviewFieldChange[] {
  const changes: ReviewFieldChange[] = [];
  if (JSON.stringify(draft) === JSON.stringify(published)) {
    return changes;
  }

  const walk = (path: string, d: unknown, p: unknown): void => {
    if (typeof d === 'string' && typeof p === 'string') {
      const segments = path.split(' · ').map(humanizeSegment);
      pushStringChange(changes, 'settings', formatChangeLabel('settings', ...segments), p, d);
      return;
    }
    if (Array.isArray(d) && Array.isArray(p)) {
      if (JSON.stringify(d) !== JSON.stringify(p)) {
        const segments = path.split(' · ').map(humanizeSegment);
        changes.push({
          locale: 'settings',
          label: formatChangeLabel('settings', ...segments),
          kind: 'changed',
          before: truncate(JSON.stringify(p)),
          after: truncate(JSON.stringify(d)),
        });
      }
      return;
    }
    if (typeof d === 'object' && d !== null && typeof p === 'object' && p !== null) {
      for (const key of new Set([...Object.keys(d as object), ...Object.keys(p as object)])) {
        walk(path ? `${path} · ${key}` : key, (d as Record<string, unknown>)[key], (p as Record<string, unknown>)[key]);
      }
    }
  };

  walk('', draft, published);
  return changes;
}

function missingEnTranslationWarnings(
  enDraft: ContentDocument,
  enPublished: ContentDocument,
  esChanges: ReviewFieldChange[],
): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];

  for (const change of esChanges) {
    if (change.locale !== 'es' || change.kind !== 'changed') {
      continue;
    }

    const heroMatch = change.label.match(new RegExp(`^ES › ${SECTION_TITLES.hero} › (.+)$`));
    if (heroMatch) {
      const fieldLabel = heroMatch[1];
      const fieldKey = Object.entries(HERO_FIELDS).find(([, label]) => label === fieldLabel)?.[0];
      if (fieldKey) {
        const enBefore = enPublished.hero[fieldKey as keyof typeof enPublished.hero];
        const enAfter = enDraft.hero[fieldKey as keyof typeof enDraft.hero];
        if (typeof enBefore === 'string' && typeof enAfter === 'string' && enBefore === enAfter) {
          warnings.push({ label: change.label, message: 'Falta traducción EN' });
        }
      }
    }

    const keyFiguresMatch = change.label.match(
      new RegExp(`^ES › ${SECTION_TITLES.keyFigures} › (.+)$`),
    );
    if (keyFiguresMatch) {
      const fieldLabel = keyFiguresMatch[1];
      const fieldKey = Object.entries(KEY_FIGURES_FIELDS).find(([, label]) => label === fieldLabel)?.[0];
      if (fieldKey) {
        const enBefore = enPublished.keyFigures[fieldKey as keyof typeof enPublished.keyFigures];
        const enAfter = enDraft.keyFigures[fieldKey as keyof typeof enDraft.keyFigures];
        if (typeof enBefore === 'string' && typeof enAfter === 'string' && enBefore === enAfter) {
          warnings.push({ label: change.label, message: 'Falta traducción EN' });
        }
      }
    }

    const templatesMatch = change.label.match(new RegExp(`^ES › ${SECTION_TITLES.templates} › (.+)$`));
    if (templatesMatch) {
      const fieldLabel = templatesMatch[1];
      const fieldKey = Object.entries(TEMPLATES_TRANSLATABLE_FIELDS).find(([, label]) => label === fieldLabel)?.[0];
      if (fieldKey) {
        const enBefore = enPublished.templates[fieldKey as keyof typeof enPublished.templates];
        const enAfter = enDraft.templates[fieldKey as keyof typeof enDraft.templates];
        if (typeof enBefore === 'string' && typeof enAfter === 'string' && enBefore === enAfter) {
          warnings.push({ label: change.label, message: 'Falta traducción EN' });
        }
      }

      const itemMatch = fieldLabel.match(/^Ítem (\d+) › (.+)$/);
      if (itemMatch) {
        const index = Number(itemMatch[1]) - 1;
        const itemFieldLabel = itemMatch[2];
        const itemFieldKey = Object.entries(TEMPLATES_TRANSLATABLE_ITEM_FIELDS).find(
          ([, label]) => label === itemFieldLabel,
        )?.[0];
        if (itemFieldKey) {
          const enBefore = enPublished.templates.items[index]?.[
            itemFieldKey as keyof (typeof enPublished.templates.items)[number]
          ];
          const enAfter = enDraft.templates.items[index]?.[
            itemFieldKey as keyof (typeof enDraft.templates.items)[number]
          ];
          if (typeof enBefore === 'string' && typeof enAfter === 'string' && enBefore === enAfter) {
            warnings.push({ label: change.label, message: 'Falta traducción EN' });
          }
        }
      }
    }

    const plansMatch = change.label.match(new RegExp(`^ES › ${SECTION_TITLES.plans} › (.+)$`));
    if (plansMatch) {
      const fieldLabel = plansMatch[1];
      const fieldKey = Object.entries(PLANS_FIELDS).find(([, label]) => label === fieldLabel)?.[0];
      if (fieldKey) {
        const enBefore = enPublished.plans[fieldKey as keyof typeof enPublished.plans];
        const enAfter = enDraft.plans[fieldKey as keyof typeof enDraft.plans];
        if (typeof enBefore === 'string' && typeof enAfter === 'string' && enBefore === enAfter) {
          warnings.push({ label: change.label, message: 'Falta traducción EN' });
        }
      }
    }
  }

  return warnings;
}

function validationErrorsForLocale(draft: unknown, label: string): string[] {
  try {
    parseContentDocument(draft);
    return [];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Documento inválido';
    return [`${label}: ${message}`];
  }
}

function validationErrorsForSettings(draft: unknown): string[] {
  try {
    parseSiteSettings(draft);
    return [];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuración inválida';
    return [`Configuración: ${message}`];
  }
}

export function buildPublishReview(input: {
  draft: { es: unknown; en: unknown; settings: unknown };
  published: { es: unknown; en: unknown; settings: unknown };
}): PublishReview {
  const validationErrors = [
    ...validationErrorsForLocale(input.draft.es, 'ES'),
    ...validationErrorsForLocale(input.draft.en, 'EN'),
    ...validationErrorsForSettings(input.draft.settings),
  ];

  let changes: ReviewFieldChange[] = [];
  let warnings: ReviewWarning[] = [];

  try {
    const esDraft = input.draft.es as ContentDocument;
    const enDraft = input.draft.en as ContentDocument;
    const esPublished = input.published.es as ContentDocument;
    const enPublished = input.published.en as ContentDocument;
    const settingsDraft = input.draft.settings as SiteSettings;
    const settingsPublished = input.published.settings as SiteSettings;

    const esChanges = diffLocaleDocument('es', esDraft, esPublished);
    const enChanges = diffLocaleDocument('en', enDraft, enPublished);
    const settingsChanges = diffSettings(settingsDraft, settingsPublished);

    changes = [...esChanges, ...enChanges, ...settingsChanges];

    const parityWarnings = (() => {
      try {
        return checkLocaleParity(
          parseContentDocument(input.draft.es),
          parseContentDocument(input.draft.en),
        ).map((issue) => ({
          label: issue.path,
          message: issue.message,
        }));
      } catch {
        // Invalid draft — schema issues are reported in validationErrors below.
        return [];
      }
    })();

    const translationWarnings = missingEnTranslationWarnings(enDraft, enPublished, esChanges);
    warnings = [...translationWarnings, ...parityWarnings];
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Error inesperado';
    validationErrors.push(
      `No se pudo comparar el borrador con lo publicado (${detail}). Es posible que el contenido publicado esté desactualizado respecto al esquema actual — guarda el borrador o descarta y vuelve a cargar.`,
    );
  }

  return {
    changes,
    warnings,
    validationErrors,
    changeCount: changes.length,
  };
}

export function reviewBlocksPublish(review: PublishReview): boolean {
  return review.validationErrors.length > 0;
}

export function reviewHasNoChanges(review: PublishReview): boolean {
  return review.changeCount === 0;
}
