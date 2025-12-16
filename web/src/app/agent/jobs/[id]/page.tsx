'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { formatTime } from '@/lib/formatting';
import Image from 'next/image';

// Extract error message from API response (handles both string and object errors)
function getErrorMessage(data: { error?: string | { message?: string } }, fallback: string): string {
  if (!data.error) return fallback;
  if (typeof data.error === 'string') return data.error;
  return data.error.message || fallback;
}

type JobDetail = {
  id: string;
  request_id: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  estimated_minutes: number;
  details: string | null;
  status: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  city: string;
  state: string;
  agent_payout_cents: number;
  started_at: string | null;
  completed_at: string | null;
  has_checkin: boolean;
  has_checkout: boolean;
  has_box_photo: boolean;
  has_finished_photo: boolean;
  job_latitude: number | null;
  job_longitude: number | null;
};

type ProofPhoto = {
  id: string;
  type: 'box' | 'finished';
  photo_url: string;
  notes: string | null;
  uploaded_at: string;
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<'box' | 'finished' | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/jobs/${jobId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(getErrorMessage(data, 'Failed to load job'));
      }

      setJob(data.job);
      setPhotos(data.photos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const handleCheckIn = async () => {
    setActionLoading('checkin');
    setGpsError(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const res = await fetch(`/api/agent/jobs/${jobId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.distance_meters) {
          setGpsError(`Too far from job location (${Math.round(data.distance_meters)}m away). Must be within 100m.`);
        } else {
          throw new Error(getErrorMessage(data, 'Failed to check in'));
        }
        return;
      }

      await loadJob();
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        setGpsError('Could not get your location. Please enable GPS and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to check in');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async () => {
    if (!job?.has_box_photo || !job?.has_finished_photo) {
      setError('Please upload both box and finished photos before checking out');
      return;
    }

    setActionLoading('checkout');
    setGpsError(null);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const res = await fetch(`/api/agent/jobs/${jobId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(getErrorMessage(data, 'Failed to check out'));
      }

      // Show success message after checkout
      setError(null);
      await loadJob();
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        setGpsError('Could not get your location. Please enable GPS and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to check out');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handlePhotoUpload = async (type: 'box' | 'finished', file: File) => {
    setUploadingPhoto(type);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Upload to Supabase Storage
      const fileName = `${session.user.id}/${jobId}/${type}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('proof-of-work')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('proof-of-work')
        .getPublicUrl(fileName);

      // Save proof record
      const res = await fetch(`/api/agent/jobs/${jobId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          photo_url: urlData.publicUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(getErrorMessage(data, 'Failed to save proof'));
      }

      await loadJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatServiceType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700"></div>
          <p className="text-sm text-slate-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900">Job not found</p>
          <button
            onClick={() => router.push('/agent?tab=jobs')}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  const canCheckIn = job.status === 'assigned' && !job.has_checkin;
  const canUploadPhotos = job.status === 'in_progress' || job.has_checkin;
  const canCheckOut = job.has_checkin && job.has_box_photo && job.has_finished_photo && !job.has_checkout;
  const isCompleted = job.status === 'completed';

  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/agent?tab=jobs')}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Jobs
          </button>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              job.status === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : job.status === 'pending_verification'
                ? 'bg-indigo-100 text-indigo-700'
                : job.status === 'in_progress'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {job.status === 'in_progress'
              ? 'In Progress'
              : job.status === 'pending_verification'
              ? 'Pending Review'
              : job.status === 'completed'
              ? 'Completed'
              : 'Assigned'}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-4 pb-32">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        {gpsError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {gpsError}
          </div>
        )}

        {/* Job Info Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h1 className="text-xl font-bold text-slate-900">{formatServiceType(job.service_type)}</h1>
            <p className="mt-1 text-lg font-semibold text-emerald-600">
              You earn: {formatCurrency(job.agent_payout_cents)}
            </p>
          </div>

          <div className="space-y-4 px-5 py-4">
            {/* Date & Time */}
            <div className="flex items-center gap-3">
              <span className="text-xl">📅</span>
              <div>
                <p className="font-medium text-slate-900">
                  {new Date(job.preferred_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-slate-500">{formatTime(job.preferred_time)} • Est. {formatDuration(job.estimated_minutes)}</p>
              </div>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-3">
              <span className="text-xl">👤</span>
              <div>
                <p className="font-medium text-slate-900">{job.customer_name}</p>
                {job.customer_phone && (
                  <a href={`tel:${job.customer_phone}`} className="text-sm text-emerald-600 hover:underline">
                    {job.customer_phone}
                  </a>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-center gap-3">
              <span className="text-xl">📍</span>
              <div>
                <p className="font-medium text-slate-900">{job.address || `${job.city}, ${job.state}`}</p>
                {job.job_latitude && job.job_longitude && (
                  <a
                    href={`https://maps.google.com/?q=${job.job_latitude},${job.job_longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    Open in Maps
                  </a>
                )}
              </div>
            </div>

            {/* Details */}
            {job.details && (
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Job Notes:</p>
                <p className="mt-1 text-sm text-slate-600">{job.details}</p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Job Progress</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Step 1: Check In */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    job.has_checkin ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {job.has_checkin ? '✓' : '1'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">Check In</p>
                  <p className="text-sm text-slate-500">Verify you&apos;re at the job location</p>
                </div>
              </div>
              {canCheckIn && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading === 'checkin'}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {actionLoading === 'checkin' ? 'Checking...' : 'Check In'}
                </button>
              )}
              {job.has_checkin && <span className="text-sm text-emerald-600">Done</span>}
            </div>

            {/* Step 2: Box Photo */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    job.has_box_photo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {job.has_box_photo ? '✓' : '2'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">Box Photo</p>
                  <p className="text-sm text-slate-500">Photo of unopened product/materials</p>
                </div>
              </div>
              {canUploadPhotos && !job.has_box_photo && (
                <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  {uploadingPhoto === 'box' ? 'Uploading...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload('box', file);
                    }}
                    disabled={uploadingPhoto !== null}
                  />
                </label>
              )}
              {job.has_box_photo && <span className="text-sm text-emerald-600">Done</span>}
            </div>

            {/* Step 3: Finished Photo */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    job.has_finished_photo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {job.has_finished_photo ? '✓' : '3'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">Finished Photo</p>
                  <p className="text-sm text-slate-500">Photo of completed work</p>
                </div>
              </div>
              {canUploadPhotos && !job.has_finished_photo && (
                <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  {uploadingPhoto === 'finished' ? 'Uploading...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload('finished', file);
                    }}
                    disabled={uploadingPhoto !== null}
                  />
                </label>
              )}
              {job.has_finished_photo && <span className="text-sm text-emerald-600">Done</span>}
            </div>

            {/* Step 4: Check Out */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    job.has_checkout ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {job.has_checkout ? '✓' : '4'}
                </div>
                <div>
                  <p className="font-medium text-slate-900">Check Out</p>
                  <p className="text-sm text-slate-500">Complete the job and get paid</p>
                </div>
              </div>
              {canCheckOut && (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading === 'checkout'}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  {actionLoading === 'checkout' ? 'Completing...' : 'Check Out'}
                </button>
              )}
              {job.has_checkout && <span className="text-sm text-emerald-600">Done</span>}
            </div>
          </div>
        </div>

        {/* Uploaded Photos */}
        {photos.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Uploaded Photos</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5">
              {photos.map((photo) => (
                <div key={photo.id} className="relative h-40">
                  <Image
                    src={photo.photo_url}
                    alt={photo.type === 'box' ? 'Box photo' : 'Finished photo'}
                    fill
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
                    {photo.type === 'box' ? 'Before' : 'After'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Verification Message */}
        {job.status === 'pending_verification' && (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-center">
            <div className="mb-2 text-4xl">✅</div>
            <h3 className="text-lg font-semibold text-indigo-800">Job Submitted for Review</h3>
            <p className="mt-1 text-sm text-indigo-600">
              Your work is being reviewed. You&apos;ll be paid {formatCurrency(job.agent_payout_cents)} once verified.
            </p>
          </div>
        )}

        {/* Completion Message */}
        {isCompleted && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="mb-2 text-4xl">🎉</div>
            <h3 className="text-lg font-semibold text-emerald-800">Job Completed!</h3>
            <p className="mt-1 text-sm text-emerald-600">
              You earned {formatCurrency(job.agent_payout_cents)}. Funds available in ~2 hours.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
