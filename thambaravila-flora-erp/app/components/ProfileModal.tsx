'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Current User Profile State
  const [profile, setProfile] = useState<any>({
    name: '',
    email: '',
    idNumber: '',
    phone: '',
    avatarUrl: '🌱',
    roleName: '',
  });

  // Team members list for Owner / IT Admin
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'my_profile' | 'security' | 'team_directory'>('my_profile');
  const [msg, setMsg] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const avatarPresets = ['🌱', '🌸', '👑', '💼', '📊', '🤝', '🛡️', '✨', '🌺', '🍃'];

  useEffect(() => {
    if (isOpen && session) {
      setActiveTab('my_profile');
      setPasswordNotice(null);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      fetchProfileData();
    }
  }, [isOpen, session]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setTeamMembers(data.teamMembers || []);
      }
    } catch (e) {
      console.error('Failed to load profile data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          idNumber: profile.idNumber,
          phone: profile.phone,
          avatarUrl: profile.avatarUrl,
        }),
      });

      if (res.ok) {
        setMsg('✓ Profile details saved successfully!');
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg('❌ Failed to update profile');
      }
    } catch (e) {
      console.error(e);
      setMsg('❌ Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordNotice(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'New passwords do not match.' });
      setChangingPassword(false);
      return;
    }

    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.details) ? ` ${data.details.join('. ')}` : '';
        setPasswordNotice({ type: 'error', text: `${data.error || 'Failed to change password.'}${details}` });
        return;
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordNotice({ type: 'success', text: 'Password changed. Signing you out securely...' });
      window.setTimeout(() => signOut({ callbackUrl: '/auth/signin' }), 1200);
    } catch (error) {
      console.error(error);
      setPasswordNotice({ type: 'error', text: 'Could not change password. Check connection and try again.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordChecks = [
    { label: '12 or more characters', met: passwordForm.newPassword.length >= 12 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(passwordForm.newPassword) },
    { label: 'Lowercase letter', met: /[a-z]/.test(passwordForm.newPassword) },
    { label: 'Number', met: /[0-9]/.test(passwordForm.newPassword) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(passwordForm.newPassword) },
  ];

  if (!isOpen) return null;

  const roleName = session?.user?.role?.name || '';
  const isOwnerOrIT = roleName === 'Owner' || roleName === 'IT/Admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-flora-dark border border-flora-border max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-flora-darker border-b border-flora-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-flora-green to-flora-sage text-slate-950 font-black text-lg flex items-center justify-center shadow">
              {profile.avatarUrl.length <= 2 ? profile.avatarUrl : '👤'}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-100">{profile.name || 'User Profile'}</h2>
              <p className="text-xs text-flora-sage font-semibold">{profile.roleName} Profile &amp; ID Settings</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-flora-card border border-flora-border text-slate-400 hover:text-white flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-12 gap-1 overflow-x-auto border-b border-flora-border bg-flora-darker/40 px-4 pt-2 text-xs font-bold sm:px-5">
          <button
            type="button"
            onClick={() => setActiveTab('my_profile')}
            className={`min-h-11 shrink-0 border-b-2 px-3 transition ${
              activeTab === 'my_profile'
                ? 'border-flora-sage text-flora-sage font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`min-h-11 shrink-0 border-b-2 px-3 transition ${
              activeTab === 'security'
                ? 'border-flora-sage text-flora-sage font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Change Password
          </button>
          {isOwnerOrIT && (
            <button
              type="button"
              onClick={() => setActiveTab('team_directory')}
              className={`min-h-11 shrink-0 border-b-2 px-3 transition ${
                activeTab === 'team_directory'
                  ? 'border-flora-sage text-flora-sage font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Team Directory ({teamMembers.length})
            </button>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {msg && (
            <div className={`p-3 rounded-xl font-bold border ${msg.includes('✓') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
              {msg}
            </div>
          )}

          {activeTab === 'my_profile' ? (
            /* My Profile Form */
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Avatar Selector */}
              <div>
                <label className="block font-bold text-slate-300 mb-2">Choose Profile Avatar Icon</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {avatarPresets.map((av) => (
                    <button
                      type="button"
                      key={av}
                      onClick={() => setProfile((p: any) => ({ ...p, avatarUrl: av }))}
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border transition ${
                        profile.avatarUrl === av
                          ? 'bg-flora-sage/20 border-flora-sage scale-110 shadow-lg'
                          : 'bg-flora-darker border-flora-border hover:bg-flora-card'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profile.name}
                    onChange={(e) => setProfile((p: any) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-flora-darker border border-flora-border text-slate-100 rounded-xl focus:outline-none focus:border-flora-sage"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">ID Number (NIC / Staff ID)</label>
                  <input
                    type="text"
                    required
                    value={profile.idNumber}
                    onChange={(e) => setProfile((p: any) => ({ ...p, idNumber: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-flora-darker border border-flora-border text-slate-100 rounded-xl font-mono focus:outline-none focus:border-flora-sage"
                    placeholder="e.g. 199482910V or TF-EMP-001"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile((p: any) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-flora-darker border border-flora-border text-slate-100 rounded-xl focus:outline-none focus:border-flora-sage"
                    placeholder="+94 77 123 4567"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 mb-1">Account Email (System Locked)</label>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full px-3.5 py-2.5 bg-flora-darker/50 border border-flora-border text-slate-500 rounded-xl font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Role Info Box */}
              <div className="p-4 rounded-2xl bg-flora-darker border border-flora-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">System Designation &amp; Security</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assigned Role: <span className="font-bold text-flora-sage">{profile.roleName}</span></p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 rounded-lg">
                  Active Member
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-flora-card text-slate-300 font-bold rounded-xl border border-flora-border hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-black rounded-xl shadow-lg hover:from-flora-sage hover:to-flora-green transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          ) : activeTab === 'security' ? (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <h3 className="text-base font-black text-slate-100">Change account password</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Verify current password, then create a unique password. Successful change signs this device out.
                </p>
              </div>

              {passwordNotice && (
                <div className={`rounded-xl border p-3 font-bold ${
                  passwordNotice.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/20 text-rose-300'
                }`} role="status">
                  {passwordNotice.text}
                </div>
              )}

              <div>
                <label htmlFor="current-password" className="mb-1 block font-bold text-slate-300">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((current) => ({ ...current, currentPassword: e.target.value }))}
                  className="min-h-12 w-full rounded-xl border border-flora-border bg-flora-darker px-3.5 py-2.5 text-slate-100 outline-none focus:border-flora-sage focus:ring-2 focus:ring-flora-sage/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-password" className="mb-1 block font-bold text-slate-300">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={256}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))}
                    className="min-h-12 w-full rounded-xl border border-flora-border bg-flora-darker px-3.5 py-2.5 text-slate-100 outline-none focus:border-flora-sage focus:ring-2 focus:ring-flora-sage/20"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1 block font-bold text-slate-300">Confirm New Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={256}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))}
                    className="min-h-12 w-full rounded-xl border border-flora-border bg-flora-darker px-3.5 py-2.5 text-slate-100 outline-none focus:border-flora-sage focus:ring-2 focus:ring-flora-sage/20"
                  />
                  {passwordForm.confirmPassword && (
                    <p className={`mt-1.5 text-[11px] font-bold ${
                      passwordForm.newPassword === passwordForm.confirmPassword ? 'text-emerald-300' : 'text-rose-300'
                    }`}>
                      {passwordForm.newPassword === passwordForm.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-flora-border bg-flora-darker p-4">
                <div className="font-bold text-slate-200">Password requirements</div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className={`flex items-center gap-2 text-[11px] font-semibold ${check.met ? 'text-emerald-300' : 'text-slate-400'}`}>
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${check.met ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {check.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={changingPassword}
                  className="min-h-11 rounded-xl border border-flora-border bg-flora-card px-4 py-2 font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    changingPassword
                    || !passwordForm.currentPassword
                    || !passwordChecks.every((check) => check.met)
                    || passwordForm.newPassword !== passwordForm.confirmPassword
                  }
                  className="min-h-11 rounded-xl bg-gradient-to-r from-flora-green to-flora-sage px-5 py-2 font-black text-slate-950 shadow-lg transition hover:from-flora-sage hover:to-flora-green disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          ) : (
            /* Owner & IT Team Staff ID Directory */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-100 text-sm">Staff Profile &amp; ID Directory</h3>
                <span className="text-[11px] text-flora-sage font-mono">Executive View</span>
              </div>

              <div className="overflow-x-auto border border-flora-border rounded-2xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-flora-darker text-slate-400 font-bold border-b border-flora-border uppercase">
                    <tr>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3">ID Number</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-flora-border">
                    {teamMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-flora-card/60 transition">
                        <td className="p-3 font-bold text-slate-100 flex items-center space-x-2">
                          <span className="text-sm">{m.avatarUrl || '👤'}</span>
                          <span>{m.name}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-flora-sage">
                          {m.idNumber || 'TF-EMP-00' + m.id.slice(-3).toUpperCase()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-flora-card border border-flora-border text-slate-200">
                            {m.role?.name}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{m.email}</td>
                        <td className="p-3 text-slate-300">{m.phone || '+94 77 123 4567'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
