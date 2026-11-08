import { useEffect, useRef, useState } from 'react';
import { formatLongDate, formatMonth, parseLocalDate, toLocalDate } from '@/domain/dates';
import { uid } from '@/domain/id';
import type { PhotoPose, ProgressPhotoMeta } from '@/domain/types';
import { compressImage, deletePhoto, getPhoto, putPhoto } from '@/lib/photoDb';
import { useData } from '@/store/useData';
import { EmptyState, Segmented } from '@/ui/controls';
import { confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';

/** Object URL for a stored photo, revoked on unmount. */
function usePhotoUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return setUrl(null);
    let alive = true;
    let u: string | null = null;
    getPhoto(id)
      .then((blob) => {
        if (!alive || !blob) return;
        u = URL.createObjectURL(blob);
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return url;
}

function PhotoImg({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const url = usePhotoUrl(id);
  return url ? <img src={url} alt={alt} className={className} draggable={false} /> : <div className={`${className ?? ''} photo-loading`} aria-label="Loading photo" />;
}

const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
];

export function PhotosTab() {
  const photos = useData((s) => s.photos);
  const addPhoto = useData((s) => s.addPhoto);
  const removePhoto = useData((s) => s.removePhoto);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [pose, setPose] = useState<PhotoPose>('front');
  const [date, setDate] = useState(toLocalDate());
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhotoMeta | null>(null);
  const [compare, setCompare] = useState<string[] | null>(null);
  const [comparePick, setComparePick] = useState(false);

  const pendingUrl = useObjectUrl(pending);

  const save = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const { blob, width, height } = await compressImage(pending);
      const id = uid();
      await putPhoto(id, blob);
      addPhoto({ id, date, pose, width, height, createdAt: new Date().toISOString() });
      toast('Photo saved', 'success');
      setPending(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save photo', 'error');
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: ProgressPhotoMeta) => {
    if (!(await confirm({ title: 'Delete this photo?', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deletePhoto(p.id);
    } catch {
      /* metadata removal still proceeds */
    }
    removePhoto(p.id);
    setViewing(null);
  };

  const groups = photos.reduce<{ label: string; items: ProgressPhotoMeta[] }[]>((acc, p) => {
    const label = formatMonth(parseLocalDate(p.date));
    const g = acc[acc.length - 1];
    if (g && g.label === label) g.items.push(p);
    else acc.push({ label, items: [p] });
    return acc;
  }, []);

  const pickForCompare = (p: ProgressPhotoMeta) => {
    const cur = compare ?? [];
    const next = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id].slice(-2);
    setCompare(next);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) {
            setDate(toLocalDate());
            setPending(f);
          }
        }}
      />
      <div className="photo-actions">
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={20} /> Add Photo
        </button>
        {photos.length >= 2 && (
          <button
            className={`btn ${comparePick ? 'btn-ghost' : ''}`}
            onClick={() => {
              setComparePick((v) => !v);
              setCompare([]);
            }}
          >
            <Icon name="swap" size={18} /> {comparePick ? 'Cancel' : 'Compare'}
          </button>
        )}
      </div>
      {comparePick && <p className="faint photo-hint">Select two photos to compare side by side.</p>}

      {photos.length === 0 ? (
        <EmptyState icon="image" title="No progress photos" text="Photos are stored privately on this device. Take them in the same light and pose for the best comparison." />
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <h2 className="wk-section">{g.label}</h2>
            <div className="photo-grid">
              {g.items.map((p) => {
                const sel = compare?.indexOf(p.id) ?? -1;
                return (
                  <button key={p.id} className={`photo-cell ${sel >= 0 ? 'is-selected' : ''}`} onClick={() => (comparePick ? pickForCompare(p) : setViewing(p))}>
                    <PhotoImg id={p.id} alt={`${p.pose} photo, ${p.date}`} className="photo-img" />
                    <span className="photo-tag">{formatLongDate(p.date).replace(/^\w+, /, '')}</span>
                    {sel >= 0 && <span className="photo-sel num">{sel + 1}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {comparePick && compare?.length === 2 && (
        <div className="photo-compare-bar">
          <button className="btn btn-primary btn-block" onClick={() => setComparePick(false)}>
            Compare Photos
          </button>
        </div>
      )}

      {/* New photo */}
      <Sheet
        open={!!pending}
        onClose={() => !busy && setPending(null)}
        title="New Photo"
        left={<button className="nav-btn" onClick={() => setPending(null)} disabled={busy}>Cancel</button>}
        right={<button className="nav-btn is-strong" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>}
      >
        {pendingUrl && <img src={pendingUrl} alt="Preview" className="photo-preview" />}
        <div className="field">
          <span>Pose</span>
          <Segmented value={pose} onChange={setPose} options={POSES} />
        </div>
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={date} max={toLocalDate()} onChange={(e) => setDate(e.target.value)} />
        </label>
      </Sheet>

      {/* Viewer */}
      <Sheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        full
        title={viewing ? formatLongDate(viewing.date) : ''}
        left={viewing ? <button className="nav-btn" onClick={() => del(viewing)} aria-label="Delete photo"><Icon name="trash" /></button> : null}
        right={<button className="nav-btn is-strong" onClick={() => setViewing(null)}>Done</button>}
      >
        {viewing && (
          <div className="photo-view">
            <PhotoImg id={viewing.id} alt="Progress photo" className="photo-full" />
            <span className="badge badge-muted">{POSES.find((p) => p.value === viewing.pose)?.label}</span>
          </div>
        )}
      </Sheet>

      {/* Compare */}
      <Sheet
        open={!comparePick && !!compare && compare.length === 2}
        onClose={() => setCompare(null)}
        full
        title="Compare"
        right={<button className="nav-btn is-strong" onClick={() => setCompare(null)}>Done</button>}
      >
        {compare?.length === 2 && <CompareView ids={compare} />}
      </Sheet>
    </>
  );
}

function CompareView({ ids }: { ids: string[] }) {
  const photos = useData((s) => s.photos);
  const pair = ids
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is ProgressPhotoMeta => !!p)
    .sort((a, b) => a.date.localeCompare(b.date));
  const days = pair.length === 2 ? Math.round((parseLocalDate(pair[1].date).getTime() - parseLocalDate(pair[0].date).getTime()) / 86_400_000) : 0;
  return (
    <>
      <div className="compare">
        {pair.map((p, i) => (
          <figure key={p.id}>
            <PhotoImg id={p.id} alt={i === 0 ? 'Before' : 'After'} className="photo-full" />
            <figcaption>
              <strong>{i === 0 ? 'Before' : 'After'}</strong>
              <span>{formatLongDate(p.date)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="compare-gap num">{days} day{days === 1 ? '' : 's'} apart</p>
    </>
  );
}

function useObjectUrl(file: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}
