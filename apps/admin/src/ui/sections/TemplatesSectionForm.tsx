import { useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import type { ContentDocument } from '@bonae/content';
import type { LocaleSectionErrors } from '../../hooks/useFieldValidation.js';
import { getLocaleFieldError } from '../../hooks/useFieldValidation.js';
import { useFormEditSync } from '../../hooks/useFormEditSync.js';
import { FieldCard } from '../components/FieldCard.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { InlineCallout } from '../components/InlineCallout.js';

interface Props {
  doc: ContentDocument;
  onEdit?: (doc: ContentDocument) => void;
  errors: LocaleSectionErrors;
}

type TemplatesFormValues = ContentDocument['templates'];

const defaultItem = (): TemplatesFormValues['items'][number] => ({
  category: '',
  title: '',
  description: '',
  detailDescription: '',
  imageSrc: '',
  slug: '',
  demoUrl: '',
  price: 0,
  features: [],
  comingSoon: false,
});

export function TemplatesSectionForm({ doc, onEdit, errors }: Props) {
  const docRef = useRef(doc);
  docRef.current = doc;

  const { register, control, watch, setValue } = useForm<TemplatesFormValues>({
    defaultValues: doc.templates,
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' });
  const values = watch();
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useFormEditSync(watch, (formValues) => {
    onEdit?.({
      ...docRef.current,
      templates: {
        ...formValues,
        items: formValues.items.map((item) => ({
          ...item,
          price: Number(item.price) || 0,
        })),
      },
    });
  });

  return (
    <div className="space-y-4">
      <SectionHeader title="Plantillas" description="Catálogo de plantillas en el sitio" />

      <FieldCard label="Etiqueta superior" error={getLocaleFieldError(errors, 'templates', 'sectionBadge')}>
        <input className="editor-input" {...register('sectionBadge')} />
      </FieldCard>

      <FieldCard
        label="Título de sección"
        counter={{ current: (values.title ?? '').length, max: 90 }}
        error={getLocaleFieldError(errors, 'templates', 'title')}
      >
        <input className="editor-input" {...register('title')} />
      </FieldCard>

      <FieldCard
        label="Subtítulo"
        counter={{ current: (values.subheadline ?? '').length, max: 280 }}
        error={getLocaleFieldError(errors, 'templates', 'subheadline')}
      >
        <textarea className="editor-textarea" {...register('subheadline')} />
      </FieldCard>

      <FieldCard label="Texto Ver todas" error={getLocaleFieldError(errors, 'templates', 'viewAllLabel')}>
        <input className="editor-input" {...register('viewAllLabel')} />
      </FieldCard>

      <FieldCard label="Enlace Ver todas" error={getLocaleFieldError(errors, 'templates', 'viewAllHref')}>
        <input className="editor-input" {...register('viewAllHref')} placeholder="#plantillas" />
      </FieldCard>

      <details className="editor-card">
        <summary className="cursor-pointer text-xs font-semibold text-editor-muted">
          Etiquetas de detalle y modal
        </summary>
        <div className="mt-3 space-y-3">
          <FieldCard label="Ver detalles" error={getLocaleFieldError(errors, 'templates', 'viewDetailsLabel')}>
            <input className="editor-input" {...register('viewDetailsLabel')} />
          </FieldCard>
          <FieldCard label="Volver" error={getLocaleFieldError(errors, 'templates', 'backLabel')}>
            <input className="editor-input" {...register('backLabel')} />
          </FieldCard>
          <FieldCard label="Detalles técnicos" error={getLocaleFieldError(errors, 'templates', 'featuresLabel')}>
            <input className="editor-input" {...register('featuresLabel')} />
          </FieldCard>
          <FieldCard label="Moneda" error={getLocaleFieldError(errors, 'templates', 'priceCurrency')}>
            <input className="editor-input" {...register('priceCurrency')} placeholder="USD" />
          </FieldCard>
          <FieldCard label="Nota de precio" error={getLocaleFieldError(errors, 'templates', 'priceNote')}>
            <input className="editor-input" {...register('priceNote')} placeholder="pago único" />
          </FieldCard>
          <FieldCard label="Usar plantilla" error={getLocaleFieldError(errors, 'templates', 'useTemplateLabel')}>
            <input className="editor-input" {...register('useTemplateLabel')} />
          </FieldCard>
          <FieldCard label="Ver página en vivo" error={getLocaleFieldError(errors, 'templates', 'demoLabel')}>
            <input className="editor-input" {...register('demoLabel')} />
          </FieldCard>
          <FieldCard label="Modal próximamente" error={getLocaleFieldError(errors, 'templates', 'comingSoonModalBody')}>
            <textarea className="editor-textarea-sm" {...register('comingSoonModalBody')} />
          </FieldCard>
          <FieldCard label="Cerrar modal" error={getLocaleFieldError(errors, 'templates', 'comingSoonModalDismiss')}>
            <input className="editor-input" {...register('comingSoonModalDismiss')} />
          </FieldCard>
        </div>
      </details>

      <InlineCallout tone="warning">
        ES y EN deben tener la misma cantidad de plantillas y el mismo slug por ítem. Agrega o quita
        tarjetas en ambos idiomas antes de publicar.
      </InlineCallout>

      <div className="flex items-center justify-between">
        <span className="editor-label">Tarjetas de plantilla</span>
        <button
          type="button"
          className="btn-editor-add"
          disabled={fields.length >= 6}
          onClick={() => append(defaultItem())}
        >
          + Agregar plantilla
        </button>
      </div>

      {fields.map((field, index) => {
        const features = values.items?.[index]?.features ?? [];
        return (
          <div key={field.id} className="editor-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-editor-faint">Plantilla {index + 1}</span>
              <div className="flex gap-1.5">
                <button type="button" className="btn-editor-mini" disabled={index === 0} onClick={() => move(index, index - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-editor-mini"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn-editor-mini-danger"
                  disabled={fields.length <= 2}
                  onClick={() => remove(index)}
                >
                  Eliminar
                </button>
              </div>
            </div>
            <input className="editor-input" placeholder="Categoría" {...register(`items.${index}.category` as const)} />
            {getLocaleFieldError(errors, 'templates', 'items', index, 'category') && (
              <p className="editor-error-text">{getLocaleFieldError(errors, 'templates', 'items', index, 'category')}</p>
            )}
            <input className="editor-input" placeholder="Título" {...register(`items.${index}.title` as const)} />
            {getLocaleFieldError(errors, 'templates', 'items', index, 'title') && (
              <p className="editor-error-text">{getLocaleFieldError(errors, 'templates', 'items', index, 'title')}</p>
            )}
            <textarea
              className="editor-textarea-sm"
              placeholder="Descripción corta (tarjeta)"
              {...register(`items.${index}.description` as const)}
            />
            {getLocaleFieldError(errors, 'templates', 'items', index, 'description') && (
              <p className="editor-error-text">
                {getLocaleFieldError(errors, 'templates', 'items', index, 'description')}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-editor-muted">
              <input type="checkbox" {...register(`items.${index}.comingSoon` as const)} />
              Próximamente (sin página de detalle)
            </label>

            <FieldCard
              label="URL página en vivo"
              error={getLocaleFieldError(errors, 'templates', 'items', index, 'demoUrl')}
            >
              <input
                className="editor-input"
                placeholder="https://ejemplo.pages.dev"
                {...register(`items.${index}.demoUrl` as const)}
              />
            </FieldCard>

            <button
              type="button"
              className="text-xs font-semibold text-editor-muted underline"
              onClick={() => setExpandedCards((s) => ({ ...s, [field.id]: !s[field.id] }))}
            >
              {expandedCards[field.id] ? 'Ocultar detalle' : 'Detalle de plantilla'}
            </button>

            {expandedCards[field.id] && (
              <div className="space-y-2 border-t border-editor-track pt-2">
                <input
                  className="editor-input"
                  placeholder="Slug (modelo-2)"
                  {...register(`items.${index}.slug` as const)}
                />
                {getLocaleFieldError(errors, 'templates', 'items', index, 'slug') && (
                  <p className="editor-error-text">{getLocaleFieldError(errors, 'templates', 'items', index, 'slug')}</p>
                )}
                <textarea
                  className="editor-textarea-sm"
                  placeholder="Descripción larga (detalle)"
                  {...register(`items.${index}.detailDescription` as const)}
                />
                <input
                  className="editor-input"
                  placeholder="Imagen (/images/templates/...)"
                  {...register(`items.${index}.imageSrc` as const)}
                />
                <input
                  className="editor-input"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Precio"
                  {...register(`items.${index}.price` as const, { valueAsNumber: true })}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="editor-label">Detalles técnicos</span>
                    <button
                      type="button"
                      className="btn-editor-mini"
                      disabled={features.length >= 8}
                      onClick={() =>
                        setValue(`items.${index}.features`, [...features, ''], { shouldDirty: true })
                      }
                    >
                      + Feature
                    </button>
                  </div>
                  {features.map((_, featureIndex) => (
                    <div key={featureIndex} className="flex gap-2">
                      <input
                        className="editor-input flex-1"
                        placeholder={`Feature ${featureIndex + 1}`}
                        {...register(`items.${index}.features.${featureIndex}` as const)}
                      />
                      <button
                        type="button"
                        className="btn-editor-mini-danger"
                        onClick={() =>
                          setValue(
                            `items.${index}.features`,
                            features.filter((_, i) => i !== featureIndex),
                            { shouldDirty: true },
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
