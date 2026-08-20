'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from '../context/ThemeContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_WALLPAPERS = [
  {
    id: 'default',
    name: 'Original Flora ERP',
    url: '',
    preview: '/dashboard-floral-bg.png',
    desc: 'Default Thambaravila botanical watercolor artwork',
  },
  {
    id: 'emerald-botanic',
    name: 'Emerald Botanic Garden',
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80',
    desc: 'Lush tropical emerald foliage & rainforest leaves',
  },
  {
    id: 'midnight-rose',
    name: 'Midnight Rose Luxury',
    url: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=400&q=80',
    desc: 'Deep velvety petals with ambient lighting',
  },
  {
    id: 'golden-bloom',
    name: 'Golden Bloom Elegance',
    url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=400&q=80',
    desc: 'Warm sunset wedding floral bloom',
  },
  {
    id: 'minimal-slate',
    name: 'Modern Executive Slate',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
    preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    desc: 'Clean contemporary architectural flow',
  },
];

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { data: session } = useSession();
  const { theme, customBg, setCustomBg } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current User Profile State
  const [profile, setProfile] = useState<any>({
    name: '',
    email: '',
    idNumber: '',
    phone: '',
    avatarUrl: '🌱',
    bgImageUrl: null,
    roleName: '',
  });

  // Background Customization State
  const [customBgPreview, setCustomBgPreview] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'dark' | 'light'>('dark');

  // Team members list for Owner / IT Admin
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'my_profile' | 'background' | 'security' | 'team_directory'>('my_profile');
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
      setPreviewMode(theme);
      fetchProfileData();
    }
  }, [isOpen, session, theme]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setCustomBgPreview(data.profile.bgImageUrl || customBg || null);
        setTeamMembers(data.teamMembers || []);
      }
    } catch (e) {
      console.error('Failed to load profile data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMsg('❌ Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMsg('❌ Image size is too large. Please select an image under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCustomBgPreview(optimizedDataUrl);
          setMsg('📷 Image loaded! Click "Apply & Save Background" to set it.');
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBackground = async () => {
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bgImageUrl: customBgPreview || '',
        }),
      });

      if (res.ok) {
        setCustomBg(customBgPreview || null);
        setMsg('✓ Background image updated and applied across all views!');
        setTimeout(() => setMsg(''), 3500);
      } else {
        setMsg('❌ Failed to update background image');
      }
    } catch {
      setMsg('❌ Error saving background');
    } finally {
      setSaving(false);
    }
  };

  const handleResetBackground = async () => {
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bgImageUrl: '',
        }),
      });

      if (res.ok) {
        setCustomBgPreview(null);
        setCustomBg(null);
        setMsg('✓ Restored default Thambaravila Flora background!');
        setTimeout(() => setMsg(''), 3500);
      } else {
        setMsg('❌ Failed to reset background');
      }
    } catch {
      setMsg('❌ Error resetting background');
    } finally {
      setSaving(false);
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

        {/* Tab Navigation */}
        <div className="flex min-h-12 gap-1 overflow-x-auto border-b border-flora-border bg-flora-darker/40 px-4 pt-2 text-xs font-bold sm:px-5">
          <button
            type="button"
            onClick={() => setActiveTab('my_profile')}
            className={`min-h-11 shrink-0 border-b-2 px-3 transition flex items-center gap-1.5 ${
              activeTab === 'my_profile'
                ? 'border-flora-sage text-flora-sage font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>👤</span>
            <span>My Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('background')}
            className={`min-h-11 shrink-0 border-b-2 px-3 transition flex items-center gap-1.5 ${
              activeTab === 'background'
                ? 'border-flora-sage text-flora-sage font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🖼️</span>
            <span>Custom Background</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`min-h-11 shrink-0 border-b-2 px-3 transition flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-flora-sage text-flora-sage font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔒</span>
            <span>Change Password</span>
          </button>
          {isOwnerOrIT && (
            <button
              type="button"
              onClick={() => setActiveTab('team_directory')}
              className={`min-h-11 shrink-0 border-b-2 px-3 transition flex items-center gap-1.5 ${
                activeTab === 'team_directory'
                  ? 'border-flora-sage text-flora-sage font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>👥</span>
              <span>Team Directory ({teamMembers.length})</span>
            </button>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {msg && (
            <div className={`p-3 rounded-xl font-bold border ${msg.includes('✓') || msg.includes('📷') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
              {msg}
            </div>
          )}

          {activeTab === 'background' ? (
            /* ── Custom Background Tab ── */
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <span>🖼️</span> Personalize ERP Background Image
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Upload any wallpaper from your device or choose a curated aesthetic theme. The background automatically scales and adapts smoothly for both <b>Dark Mode</b> and <b>Light Mode</b>.
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="bg-flora-darker border border-flora-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <span>👁️</span> Live Wallpaper Preview
                  </span>
                  <div className="flex items-center space-x-1.5 bg-flora-card border border-flora-border rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('dark')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                        previewMode === 'dark'
                          ? 'bg-slate-900 text-flora-sage border border-flora-border shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🌙</span> Dark Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('light')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                        previewMode === 'light'
                          ? 'bg-white text-slate-900 border border-slate-300 shadow font-extrabold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>☀️</span> Light Mode
                    </button>
                  </div>
                </div>

                {/* Simulated App Frame */}
                <div
                  className="relative h-44 rounded-xl border border-flora-border overflow-hidden bg-cover bg-center shadow-inner flex flex-col justify-between p-3.5 transition-all"
                  style={{
                    backgroundImage: customBgPreview ? `url("${customBgPreview}")` : 'url("/dashboard-floral-bg.png")',
                  }}
                >
                  {/* Adaptive Overlay Simulation */}
                  {previewMode === 'light' ? (
                    <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] bg-gradient-to-b from-white/85 via-white/60 to-white/80 pointer-events-none" />
                  ) : (
                    <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] bg-gradient-to-b from-slate-950/75 via-slate-950/50 to-slate-950/80 pointer-events-none" />
                  )}

                  {/* Sample Mockup ERP Cards */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-xs">
                        🌸
                      </div>
                      <span className={`text-xs font-black tracking-wider ${previewMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        THAMBARAVILA ERP
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                      Live Preview
                    </span>
                  </div>

                  <div className="relative z-10 grid grid-cols-2 gap-2">
                    <div className={`p-2.5 rounded-xl border backdrop-blur-sm shadow ${
                      previewMode === 'light'
                        ? 'bg-white/95 border-slate-300 text-slate-900'
                        : 'bg-slate-900/90 border-flora-border text-slate-100'
                    }`}>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Total Bookings</div>
                      <div className="text-sm font-black text-flora-sage">24 Events</div>
                    </div>
                    <div className={`p-2.5 rounded-xl border backdrop-blur-sm shadow ${
                      previewMode === 'light'
                        ? 'bg-white/95 border-slate-300 text-slate-900'
                        : 'bg-slate-900/90 border-flora-border text-slate-100'
                    }`}>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Active Role</div>
                      <div className="text-sm font-black text-amber-400">{profile.roleName || 'Staff'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Custom File Area */}
              <div>
                <label className="block font-bold text-slate-300 mb-2">Upload From Your Device</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="border-2 border-dashed border-flora-border hover:border-flora-sage/80 bg-flora-darker/60 hover:bg-flora-darker rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-flora-card border border-flora-border text-2xl flex items-center justify-center group-hover:scale-110 transition shadow">
                    📁
                  </div>
                  <div>
                    <span className="font-extrabold text-flora-sage text-xs">Click to browse</span>
                    <span className="text-slate-400 text-xs"> or drag &amp; drop an image</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Supports PNG, JPG, WEBP • Automatically optimized for instant loading
                  </p>
                </div>
              </div>

              {/* Curated Theme Presets */}
              <div>
                <label className="block font-bold text-slate-300 mb-2">Or Choose from Curated Theme Wallpapers</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRESET_WALLPAPERS.map((preset) => {
                    const isSelected = (!customBgPreview && preset.id === 'default') || customBgPreview === preset.url;
                    return (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => {
                          setCustomBgPreview(preset.url || null);
                          setMsg(`✨ Selected "${preset.name}". Click "Apply & Save Background" below.`);
                        }}
                        className={`group relative rounded-xl border p-2 text-left transition overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'border-flora-sage bg-flora-sage/10 shadow-lg ring-2 ring-flora-sage/40'
                            : 'border-flora-border bg-flora-darker hover:border-slate-400'
                        }`}
                      >
                        <div
                          className="h-16 rounded-lg bg-cover bg-center border border-flora-border mb-2 group-hover:scale-[1.02] transition"
                          style={{ backgroundImage: `url("${preset.preview}")` }}
                        />
                        <div>
                          <div className="font-bold text-[11px] text-slate-200 truncate">{preset.name}</div>
                          <div className="text-[9px] text-slate-500 truncate">{preset.desc}</div>
                        </div>
                        {isSelected && (
                          <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-flora-sage text-slate-950 shadow">
                            ✓ Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-flora-border">
                <button
                  type="button"
                  onClick={handleResetBackground}
                  disabled={saving || !customBg}
                  className="px-4 py-2 bg-flora-card text-slate-400 hover:text-rose-300 font-bold rounded-xl border border-flora-border hover:border-rose-700/50 transition disabled:opacity-40"
                >
                  🗑️ Reset to Default
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-flora-card text-slate-300 font-bold rounded-xl border border-flora-border hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBackground}
                    disabled={saving}
                    className="px-5 py-2 bg-gradient-to-r from-flora-green to-flora-sage hover:from-flora-sage hover:to-flora-green text-slate-950 font-black rounded-xl shadow-lg transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>🚀</span>
                    <span>{saving ? 'Applying...' : 'Apply & Save Background'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'my_profile' ? (
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
