'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

type Backup = {
  id: string;
  fileName: string;
  checksum: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: { name: string; email: string } | null;
};

type RestoreTarget =
  | { type: 'stored'; id: string; fileName: string }
  | { type: 'local'; file: File };

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupsPage() {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/backups', { cache: 'no-store' });
    if (response.ok) setBackups((await response.json()).backups);
  }, []);

  useEffect(() => { if (session) void load(); }, [load, session]);
  if (!session) return null;
  if (!['Owner', 'IT/Admin'].includes(session.user.role.name)) {
    return <div className="p-8 text-center text-rose-300">Access denied. Owner or IT/Admin only.</div>;
  }

  const clearRestore = () => {
    setRestoreTarget(null);
    setPassword('');
    setConfirmation('');
  };

  const createBackup = async () => {
    setBusy(true); setMessage(''); setMessageError(false);
    try {
      const response = await fetch('/api/admin/backups', { method: 'POST' });
      const data = await response.json();
      setMessage(response.ok ? 'Encrypted database backup created.' : data.error || 'Backup failed.');
      setMessageError(!response.ok);
      if (response.ok) await load();
    } catch {
      setMessage('Backup request failed. Check connection and try again.'); setMessageError(true);
    } finally { setBusy(false); }
  };

  const restore = async () => {
    if (!restoreTarget || confirmation !== 'RESTORE DATABASE' || !password) return;
    setBusy(true); setMessage(''); setMessageError(false);
    try {
      let response: Response;
      if (restoreTarget.type === 'stored') {
        response = await fetch(`/api/admin/backups/${restoreTarget.id}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, confirmation }),
        });
      } else {
        const body = new FormData();
        body.set('file', restoreTarget.file);
        body.set('password', password);
        body.set('confirmation', confirmation);
        response = await fetch('/api/admin/backups/local/restore', { method: 'POST', body });
      }

      const data = await response.json();
      setMessage(response.ok
        ? `Restore complete: ${data.restored.tableCount} tables and ${data.restored.rowCount} rows. Recovery backup ${data.recoveryBackup.fileName} created first.`
        : data.error || 'Restore failed.');
      setMessageError(!response.ok);
      if (response.ok) {
        clearRestore(); setLocalFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await load();
      }
    } catch {
      setMessage('Restore request failed. Database was not confirmed as restored. Check connection and backup logs.');
      setMessageError(true);
    } finally { setBusy(false); }
  };

  const selectedName = restoreTarget?.type === 'stored' ? restoreTarget.fileName : restoreTarget?.file.name;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-6 sm:py-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold text-slate-100">Encrypted Database Backups</h1><p className="mt-1 text-sm text-slate-400">AES-256-GCM snapshots. Download copies for storage outside Neon.</p></div>
        <button onClick={createBackup} disabled={busy} className="min-h-11 w-full rounded-md bg-flora-green px-5 py-2 font-bold text-slate-950 disabled:opacity-50 sm:w-auto">{busy ? 'Working...' : 'Create Backup'}</button>
      </div>

      {message && <div className={`rounded-md border px-4 py-3 text-sm ${messageError ? 'border-rose-500/40 bg-rose-950/30 text-rose-200' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'}`}>{message}</div>}

      <section className="rounded-lg border border-flora-border bg-flora-dark/90 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-bold text-slate-100">Restore from local file</h2><p className="mt-1 text-sm text-slate-400">Upload downloaded encrypted <strong className="text-slate-300">.tfbackup</strong> file, up to 4 MB. File encryption, checksum, format, and tables are checked before restore.</p></div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <input ref={fileInputRef} type="file" accept=".tfbackup,application/json" onChange={(event) => { const file = event.target.files?.[0] || null; setLocalFile(file); setMessage(''); }} className="min-h-11 w-full rounded-md border border-flora-border bg-flora-darker px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-flora-sage file:px-3 file:py-1.5 file:font-bold file:text-slate-950 sm:max-w-sm" />
            <button onClick={() => localFile && setRestoreTarget({ type: 'local', file: localFile })} disabled={!localFile || busy} className="min-h-11 shrink-0 rounded-md border border-rose-500/40 px-4 py-2 font-bold text-rose-300 disabled:opacity-40">Restore Local File</button>
          </div>
        </div>
        {localFile && <p className="mt-3 break-all text-xs text-slate-400">Selected: <span className="font-semibold text-slate-200">{localFile.name}</span> ({fileSize(localFile.size)})</p>}
      </section>

      <div className="overflow-x-auto rounded-lg border border-flora-border bg-flora-dark/90">
        <table className="min-w-[820px] w-full text-left text-sm"><thead className="border-b border-flora-border bg-flora-darker text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Created by</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-flora-border/60">{backups.map((backup) => <tr key={backup.id}><td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(backup.createdAt).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</td><td className="px-4 py-3 text-slate-100">{backup.fileName}<div className="max-w-sm truncate text-[10px] text-slate-500">SHA-256 {backup.checksum}</div></td><td className="px-4 py-3 text-slate-300">{backup.createdBy?.name || 'Restored system'}</td><td className="px-4 py-3 text-slate-300">{fileSize(backup.sizeBytes)}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><a href={`/api/admin/backups/${backup.id}`} className="inline-flex min-h-11 items-center rounded-md border border-flora-border px-3 py-2 font-semibold text-flora-sage">Download</a><button onClick={() => setRestoreTarget({ type: 'stored', id: backup.id, fileName: backup.fileName })} className="min-h-11 rounded-md border border-rose-500/40 px-3 py-2 font-semibold text-rose-300">Restore</button></div></td></tr>)}</tbody>
        </table>
        {!backups.length && <div className="p-10 text-center text-slate-500">No backups created yet.</div>}
      </div>

      {restoreTarget && <section className="rounded-lg border border-rose-500/40 bg-flora-dark p-4 sm:p-5"><h2 className="font-bold text-rose-300">Restore full database</h2><p className="mt-1 break-words text-sm text-slate-400">Source: <strong className="text-slate-200">{selectedName}</strong>. Current database rows will be replaced. Automatic pre-restore recovery backup will be created. Enter password and exact text <strong className="text-slate-200">RESTORE DATABASE</strong>.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Account password" className="min-h-11 rounded-md border border-flora-border bg-flora-darker px-3 text-slate-100" /><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESTORE DATABASE" className="min-h-11 rounded-md border border-flora-border bg-flora-darker px-3 text-slate-100" /></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><button onClick={restore} disabled={busy || !password || confirmation !== 'RESTORE DATABASE'} className="min-h-11 rounded-md bg-rose-600 px-4 py-2 font-bold text-white disabled:opacity-40">{busy ? 'Restoring...' : 'Confirm Restore'}</button><button onClick={clearRestore} disabled={busy} className="min-h-11 rounded-md border border-flora-border px-4 py-2 text-slate-300 disabled:opacity-40">Cancel</button></div></section>}
    </div>
  );
}
