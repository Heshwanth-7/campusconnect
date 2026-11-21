import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { eventCategory, saveEvent } from '../api/events';
import type { CampusEvent, EventInput } from '../api/events';
import { categoryLabels } from '../components/EventBadges';
import { Feedback } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../hooks/useEvent';
import { errorMessage, formResolver } from '../lib/auth-forms';
import { EVENT_CATEGORIES, INTERESTS } from '../lib/event-constants';
import { localDateTime } from '../lib/event-time';

const dateInput = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a date and time.');
const fields = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(160),
  description: z.string().trim().min(1, 'Enter a description.').max(3000),
  category: eventCategory,
  tags: z.array(z.enum(INTERESTS)),
  venue: z.string().trim().min(1, 'Enter a venue.').max(160),
  startsAt: dateInput,
  endsAt: dateInput,
  capacity: z.string().regex(/^\d+$/, 'Enter a whole number greater than zero.')
    .refine((value) => Number(value) >= 1 && Number(value) <= 2_147_483_647, 'Enter a supported capacity.'),
  clubName: z.string().trim().min(1, 'Enter a club name.').max(160),
});

function Field({ label, error, children }: {
  label: string;
  error?: string;
  children: (attributes: { id: string; 'aria-describedby'?: string; 'aria-invalid': boolean }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined })}
      {error && <p id={`${id}-error`} className="text-sm text-danger"><span aria-hidden="true">⚠ </span>{error}</p>}
    </div>
  );
}

function Form({ existing }: { existing?: CampusEvent }) {
  const [failure, setFailure] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { register, handleSubmit, setError, formState: { errors, dirtyFields, isSubmitting } } = useForm<z.infer<typeof fields>>({
    resolver: formResolver(fields),
    defaultValues: existing ? {
      title: existing.title, description: existing.description, category: existing.category,
      tags: existing.tags, venue: existing.venue, clubName: existing.clubName,
      startsAt: localDateTime(existing.startsAt), endsAt: localDateTime(existing.endsAt),
      capacity: String(existing.capacity),
    } : { category: 'MUSIC', tags: [] },
  });

  const submit = handleSubmit(async (values) => {
    setFailure('');
    const startsAt = new Date(existing && !dirtyFields.startsAt ? existing.startsAt : values.startsAt);
    const endsAt = new Date(existing && !dirtyFields.endsAt ? existing.endsAt : values.endsAt);
    if (endsAt <= startsAt) {
      setError('endsAt', { message: 'End time must be after start time.' }, { shouldFocus: true });
      return;
    }
    const body: EventInput = { ...values, capacity: Number(values.capacity), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
    const patch = existing
      ? Object.fromEntries(Object.entries(body).filter(([key]) => dirtyFields[key as keyof EventInput]))
      : body;
    if (existing && !Object.keys(patch).length) {
      void navigate(`/events/${existing.id}`);
      return;
    }
    try {
      const event = await saveEvent(patch, existing?.id);
      void navigate(`/events/${event.id}`, { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <form className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-8" onSubmit={submit} noValidate>
      {failure && <Feedback tone="error">{failure}</Feedback>}
      {existing?.status === 'APPROVED' && user?.role !== 'ADMIN'
        && <Feedback tone="info">Changing an approved event sends it back for review.</Feedback>}
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-4">
        <Field label="Title" error={errors.title?.message}>{(attributes) => <input {...attributes} {...register('title')} className="auth-input" maxLength={160} />}</Field>
        <Field label="Description" error={errors.description?.message}>{(attributes) => <textarea {...attributes} {...register('description')} className="auth-input py-2" maxLength={3000} rows={5} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Club name" error={errors.clubName?.message}>{(attributes) => <input {...attributes} {...register('clubName')} className="auth-input" maxLength={160} />}</Field>
          <Field label="Venue" error={errors.venue?.message}>{(attributes) => <input {...attributes} {...register('venue')} className="auth-input" maxLength={160} />}</Field>
          <Field label="Category" error={errors.category?.message}>{(attributes) => (
            <select {...attributes} {...register('category')} className="auth-input">
              {EVENT_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          )}</Field>
          <Field label="Capacity" error={errors.capacity?.message}>{(attributes) => (
            <input {...attributes} {...register('capacity')} className="auth-input" type="number" min={1} step={1} />
          )}</Field>
          <Field label="Starts at" error={errors.startsAt?.message}>{(attributes) => <input {...attributes} {...register('startsAt')} className="auth-input" type="datetime-local" />}</Field>
          <Field label="Ends at" error={errors.endsAt?.message}>{(attributes) => <input {...attributes} {...register('endsAt')} className="auth-input" type="datetime-local" />}</Field>
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-semibold">Tags</legend>
          <div className="flex flex-wrap gap-x-3">
            {INTERESTS.map((tag) => (
              <label key={tag} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" value={tag} {...register('tags')} className="size-4 accent-primary" />{tag}
              </label>
            ))}
          </div>
          {errors.tags?.message && <p className="text-sm text-danger">⚠ {errors.tags.message}</p>}
        </fieldset>
      </fieldset>
      <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : existing ? 'Save changes' : 'Create event'}</button>
    </form>
  );
}

export function EventForm() {
  const { id } = useParams();
  const result = useEvent(id);
  const { user } = useAuth();
  const existing = result?.event;
  const allowed = existing && (user?.id === existing.organizerId || user?.role === 'ADMIN');

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8 md:py-10">
      <Link to={id ? `/events/${id}` : '/events'} className="auth-link inline-flex min-h-11 items-center">← {id ? 'Back to event' : 'Back to events'}</Link>
      <h1 className="text-2xl font-semibold">{id ? 'Edit event' : 'Create event'}</h1>
      {id && !result && <Feedback tone="info">Loading event…</Feedback>}
      {result?.error && <Feedback tone="error">{result.error}</Feedback>}
      {existing && !allowed && <Feedback tone="error">Only the owner or an admin can edit this event.</Feedback>}
      {(!id || allowed) && <Form key={id ?? 'new'} existing={existing} />}
    </main>
  );
}
