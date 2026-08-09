import type { ContentDocument } from '@bonae/content';
import { asBusinessHours, defaultBusinessHoursDays } from '@bonae/content/schema';

export type ContactFormValues = {
  title: string;
  subtitle: string;
  hoursTitle: string;
  form: {
    name: string;
    email: string;
    phone: string;
    business: string;
    serviceType: string;
    message: string;
    submit: string;
    serviceOptions: Array<{ value: string }>;
  };
};

function readHoursTitle(hours: unknown): string {
  if (hours && typeof hours === 'object' && typeof (hours as { title?: unknown }).title === 'string') {
    return (hours as { title: string }).title;
  }
  if (typeof hours === 'string') {
    return hours;
  }
  return '';
}

export function readContactForm(doc: ContentDocument): ContactFormValues {
  const parsedHours = asBusinessHours(doc.contact.hours);
  return {
    title: doc.contact.title,
    subtitle: doc.contact.subtitle,
    hoursTitle: parsedHours?.title ?? readHoursTitle(doc.contact.hours),
    form: {
      name: doc.contact.form.name,
      email: doc.contact.form.email,
      phone: doc.contact.form.phone,
      business: doc.contact.form.business,
      serviceType: doc.contact.form.serviceType,
      message: doc.contact.form.message,
      submit: doc.contact.form.submit,
      serviceOptions: doc.contact.form.serviceOptions.map((value) => ({ value })),
    },
  };
}

export function applyContactForm(formValues: ContactFormValues, current: ContentDocument): ContentDocument {
  const existingHours = asBusinessHours(current.contact.hours);
  return {
    ...current,
    contact: {
      ...current.contact,
      title: formValues.title ?? '',
      subtitle: formValues.subtitle ?? '',
      hours: {
        title: formValues.hoursTitle ?? '',
        days: existingHours?.days ?? defaultBusinessHoursDays(),
      },
      form: {
        ...current.contact.form,
        name: formValues.form?.name ?? '',
        email: formValues.form?.email ?? '',
        phone: formValues.form?.phone ?? '',
        business: formValues.form?.business ?? '',
        serviceType: formValues.form?.serviceType ?? '',
        message: formValues.form?.message ?? '',
        submit: formValues.form?.submit ?? '',
        serviceOptions: (formValues.form?.serviceOptions ?? []).map((opt) => opt?.value ?? ''),
      },
    },
  };
}
