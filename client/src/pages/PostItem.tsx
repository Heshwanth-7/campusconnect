import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { category, itemFields, reportItem } from '../api/lostfound';
import { Feedback } from '../components/Feedback';
import { errorMessage, formResolver } from '../lib/auth-forms';

export function PostItem() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [photo, setPhoto] = useState<File>();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof itemFields>>({
    resolver: formResolver(itemFields), defaultValues: { type: params.get('type') === 'FOUND' ? 'FOUND' : 'LOST' },
  });
  useEffect(() => {
    const url = photo ? URL.createObjectURL(photo) : '';
    setPreview(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [photo]);
  const submit = handleSubmit(async values => {
    setError('');
    if (photo && photo.size > 5 * 1024 * 1024) return setError('Choose a photo of 5 MB or less.');
    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.set(key, value);
    if (photo) body.set('photo', photo);
    try {
      await reportItem(body);
      void navigate('/lostfound?type=' + values.type);
    } catch (reason) { setError(errorMessage(reason)); }
  });
  return <main className="mx-auto max-w-xl space-y-4 p-4 sm:p-8">
    <Link className="auth-link" to="/lostfound">← Lost &amp; Found</Link>
    <h1 className="text-3xl font-semibold">Report an item</h1>
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <label>Report type<select className="auth-input" {...register('type')}><option value="LOST">Lost</option><option value="FOUND">Found</option></select></label>
      <label>Category<select className="auth-input" required {...register('category')} defaultValue="">
        <option value="" disabled>Choose a category</option>
        {category.options.map(c => <option key={c} value={c}>{c.toLowerCase().replace('_', ' ')}</option>)}
      </select></label>
      {([['title', 'Item title'], ['description', 'Description'], ['color', 'Colour'], ['location', 'Location'], ['occurredAt', 'Date lost or found']] as const).map(([key, label]) =>
        <label key={key}>{label}
          {key === 'description' ? <textarea className="auth-input py-2" required maxLength={3000} {...register(key)} /> :
            <input className="auth-input" required maxLength={160} type={key === 'occurredAt' ? 'date' : 'text'} {...register(key)} />}
          {errors[key] && <span role="alert" className="text-sm text-danger">⚠ Enter a valid {label.toLowerCase()}.</span>}
        </label>)}
      <label>Photo (optional, up to 5 MB)
        <input className="auth-input py-2" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0])} />
      </label>
      {preview && <img className="max-h-56 w-full rounded-xl object-contain" src={preview} alt="Selected item photo" />}
      {error && <Feedback tone="error">{error}</Feedback>}
      <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Posting…' : 'Post item'}</button>
    </form>
  </main>;
}
