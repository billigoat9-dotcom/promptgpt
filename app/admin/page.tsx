'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Prompt } from '@/lib/types';

type AdminSecurityState = {
  username: string;
  twoFactorEnabled: boolean;
  hasPendingTwoFactor: boolean;
};

type AuditEvent = {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'success' | 'failure' | 'attempt';
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
};

export default function AdminDashboard() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'add' | 'manage' | 'security' | 'logs'>('add');

  // Add form state
  const [formData, setFormData] = useState({
    fullPrompt: '',
    model: 'FluxArt',
    tags: '',
    creator: 'Billi',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  // Settings
  const [settings, setSettings] = useState<AdminSecurityState>({ username: '', twoFactorEnabled: false, hasPendingTwoFactor: false });
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string;
    otpauthUrl: string;
    qrDataUrl: string;
    issuer: string;
  } | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const router = useRouter();

  const models = ['FluxArt', 'VideoGen', 'GPT Image', 'Midjourney'];

  // Fetch data
  const fetchPrompts = async () => {
    try {
      const res = await fetch('/api/admin/prompts');
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
        setTotalPrompts(data.length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSecurityState = async () => {
    try {
      const res = await fetch('/api/admin/security');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setNewUsername(data.username);
      }
    } catch (e) {}
  };

  const fetchAuditEvents = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/admin/audit?limit=120');
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data.events || []);
      }
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPrompts(), fetchSecurityState()]);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchAuditEvents();
    }
  }, [activeTab]);

  // Add form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setImageFileAndPreview = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFileAndPreview(file);
  };

  const resetAddForm = () => {
    setFormData({ fullPrompt: '', model: 'FluxArt', tags: '', creator: 'Billi' });
    setImageFileAndPreview(null);
  };

  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullPrompt) {
      alert('Full Prompt is required');
      return;
    }

    setAdding(true);

    const form = new FormData();
    form.append('fullPrompt', formData.fullPrompt);
    form.append('model', formData.model);
    form.append('tags', formData.tags);
    form.append('creator', formData.creator);
    if (imageFile) form.append('image', imageFile);

    try {
      const res = await fetch('/api/admin/prompts', { method: 'POST', body: form });
      
      let data: any = {};
      let rawText = '';

      // Safely read the body only once
      try {
        data = await res.json();
      } catch {
        try {
          rawText = await res.text();
        } catch {
          rawText = 'Could not read response body';
        }
        console.error('Failed to parse JSON response. Raw body:', rawText);
      }

      console.log('Add prompt response status:', res.status, 'data:', data);

      if (res.ok && data.success) {
        if (data.warning) {
          alert(data.warning);
        } else {
          alert('✅ Prompt added successfully! Image uploaded to Cloudinary.');
        }
        resetAddForm();
        await fetchPrompts();
        setActiveTab('manage');
      } else {
        const errorMsg = data.error || rawText || `HTTP ${res.status} - Failed to add prompt`;
        console.error('Add prompt failed:', errorMsg, 'Full response data:', data);
        alert(`Error adding prompt: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error('❌ Network or unexpected error adding prompt:', err);
      alert(`Error adding prompt: ${err.message || 'Unknown network error. Check browser console (F12).'}`);
    } finally {
      setAdding(false);
    }
  };

  // Edit handlers
  const startEdit = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setEditData({
      fullPrompt: prompt.fullPrompt,
      prompt: prompt.prompt,
      likes: prompt.likes,
      views: prompt.views,
      model: prompt.model,
      tags: prompt.tags.join(', '),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/prompts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullPrompt: editData.fullPrompt,
          prompt: editData.prompt,
          likes: Number(editData.likes),
          views: Number(editData.views),
          model: editData.model,
          tags: editData.tags ? editData.tags.split(',').map((t: string) => t.trim()) : undefined,
        }),
      });

      if (res.ok) {
        await fetchPrompts();
        cancelEdit();
        const data = await res.json().catch(() => ({}));
        alert(data.warning ? data.warning : 'Prompt updated successfully');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update');
      }
    } catch {
      alert('Error updating prompt');
    }
  };

  const deletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const res = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        await fetchPrompts();
        alert(data.warning ? data.warning : 'Prompt deleted');
      } else {
        alert('Failed to delete prompt');
      }
    } catch {
      alert('Error deleting prompt');
    }
  };

  // Settings
  const saveSettings = async () => {
    if (!newUsername || !newPassword) {
      return alert('Username and password cannot be empty');
    }

    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const base = 'Credentials updated successfully! You will be logged out.';
        alert(data.warning ? `${base} ${data.warning}` : base);
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
      } else {
        alert(data.error || 'Failed to update');
      }
    } catch {
      alert('Error updating settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setSecurityLoading(true);
    try {
      const res = await fetch('/api/admin/security/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorSetup(data);
        setTwoFactorCode('');
        alert('2FA setup started. Scan the QR code and enter the 6-digit code to confirm.');
      } else {
        alert(data.error || 'Failed to start 2FA setup');
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  const confirmTwoFactorSetup = async () => {
    if (!twoFactorCode.trim()) {
      return alert('Enter the 6-digit code from your authenticator app.');
    }

    setSecurityLoading(true);
    try {
      const res = await fetch('/api/admin/security/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode }),
      });
      const data = await res.json();

      if (res.ok) {
        alert('Two-factor authentication enabled successfully.');
        setTwoFactorSetup(null);
        setTwoFactorCode('');
        await fetchSecurityState();
      } else {
        alert(data.error || 'Failed to confirm 2FA');
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!confirm('Disable 2FA for this admin account?')) return;

    setSecurityLoading(true);
    try {
      const res = await fetch('/api/admin/security/2fa/disable', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('Two-factor authentication disabled.');
        setTwoFactorSetup(null);
        setTwoFactorCode('');
        await fetchSecurityState();
      } else {
        alert(data.error || 'Failed to disable 2FA');
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050507] text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Top Navigation */}
      <div className="border-b border-white/10 bg-[#0a0a0f] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
              <span className="font-bold text-xl">P</span>
            </div>
            <div>
              <div className="font-semibold text-2xl tracking-tight">PromptGpt Admin</div>
              <div className="text-xs text-white/50 -mt-1">Content Management</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="px-4 py-2 text-sm rounded-xl border border-white/15 hover:bg-white/5">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header + Stats */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tighter mb-2">Admin Dashboard</h1>
          <div className="flex items-center gap-6 text-lg">
            <div className="bg-[#0a0a0f] border border-white/10 px-5 py-2 rounded-2xl">
              Total Prompts: <span className="font-semibold text-violet-400">{totalPrompts}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {[
            { key: 'add', label: 'Add New Prompt' },
            { key: 'manage', label: 'Manage Prompts' },
            { key: 'security', label: 'Security' },
            { key: 'logs', label: 'Audit Logs' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.key 
                  ? 'border-violet-500 text-white' 
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ADD NEW PROMPT */}
        {activeTab === 'add' && (
          <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl p-8 max-w-3xl">
            <h2 className="text-2xl font-semibold mb-6">Add New Prompt</h2>

            <form onSubmit={handleAddPrompt} className="space-y-6">
              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Image (optional)</label>
                <div
                  className={`upload-zone rounded-2xl p-6 text-center transition-all cursor-pointer ${isDragOver ? 'dragover' : 'hover:border-white/40'}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      setImageFileAndPreview(file);
                    }
                  }}
                  onClick={() => document.getElementById('img')?.click()}
                >
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="img" />
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img src={imagePreview} className="max-h-56 mx-auto rounded-xl" alt="preview" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImageFileAndPreview(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="text-white/60">
                      <div className="mb-2">📁</div>
                      <div>Click to upload or drag & drop image here</div>
                      <div className="text-xs mt-1 text-white/40">PNG, JPG, WEBP up to 5MB</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Prompt - Main Field */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Full Detailed Prompt *</label>
                <textarea
                  name="fullPrompt"
                  value={formData.fullPrompt}
                  onChange={handleInputChange}
                  rows={8}
                  className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3 font-mono text-sm"
                  placeholder="A highly detailed cinematic scene of..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Model</label>
                  <select name="model" value={formData.model} onChange={handleInputChange} className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3">
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Creator</label>
                  <input type="text" name="creator" value={formData.creator} onChange={handleInputChange} className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Tags (comma separated)</label>
                  <input type="text" name="tags" value={formData.tags} onChange={handleInputChange} className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3" placeholder="cinematic, neon" />
                </div>
              </div>

              <button
                type="submit"
                disabled={adding || !formData.fullPrompt}
                className="w-full bg-gradient-to-r from-violet-600 to-violet-500 py-4 rounded-2xl font-semibold text-lg disabled:opacity-60"
              >
                {adding ? 'Adding...' : 'Add Prompt to Gallery'}
              </button>
            </form>
          </div>
        )}

        {/* MANAGE PROMPTS */}
        {activeTab === 'manage' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Manage Prompts ({prompts.length})</h2>

            {prompts.length === 0 && <p className="text-white/50">No prompts yet.</p>}

            {prompts.map((prompt) => (
              <div key={prompt.id} className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="md:w-48 flex-shrink-0">
                    <img src={prompt.imageUrl} className="w-full h-32 object-cover rounded-xl" alt="" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-lg mb-1 line-clamp-2">{prompt.prompt}</div>
                    <div className="text-xs text-white/50 mb-3">
                      {prompt.model} • by {prompt.creator}
                    </div>

                    {/* Edit Mode */}
                    {editingId === prompt.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editData.fullPrompt || ''}
                          onChange={(e) => setEditData({ ...editData, fullPrompt: e.target.value })}
                          className="w-full bg-[#050507] border border-white/20 rounded-xl p-3 text-sm"
                          rows={4}
                        />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-white/60">Likes</label>
                            <input type="number" value={editData.likes} onChange={(e) => setEditData({ ...editData, likes: e.target.value })} className="w-full bg-[#050507] border border-white/20 rounded-lg px-3 py-2" />
                          </div>
                          <div>
                            <label className="text-xs text-white/60">Views</label>
                            <input type="number" value={editData.views} onChange={(e) => setEditData({ ...editData, views: e.target.value })} className="w-full bg-[#050507] border border-white/20 rounded-lg px-3 py-2" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(prompt.id)} className="px-4 py-2 bg-emerald-600 rounded-xl text-sm">Save</button>
                          <button onClick={cancelEdit} className="px-4 py-2 bg-white/10 rounded-xl text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-6 text-sm mb-3">
                          <span>Likes: <strong>{prompt.likes}</strong></span>
                          <span>Views: <strong>{prompt.views}</strong></span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => startEdit(prompt)} className="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/15 rounded-xl">Edit</button>
                          <button onClick={() => deletePrompt(prompt.id)} className="px-4 py-1.5 text-sm bg-red-900/70 hover:bg-red-900 rounded-xl">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'security' && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl p-8">
              <h2 className="text-2xl font-semibold mb-6">Admin Credentials</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-white/70 mb-2">New Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3"
                    placeholder="Enter new password"
                  />
                </div>

                <button
                  onClick={saveSettings}
                  disabled={settingsLoading}
                  className="w-full bg-white text-black font-semibold py-3 rounded-2xl mt-2 disabled:opacity-60"
                >
                  {settingsLoading ? 'Saving...' : 'Update Credentials'}
                </button>

                <p className="text-xs text-white/50 text-center">You will be logged out after changing credentials.</p>
              </div>
            </div>

            <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl p-8">
              <h2 className="text-2xl font-semibold mb-3">Two-Factor Authentication</h2>
              <p className="text-sm text-white/50 mb-5">
                Current status: {settings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                {settings.hasPendingTwoFactor ? ' • Setup pending' : ''}
              </p>

              {!settings.twoFactorEnabled && !twoFactorSetup && (
                <button
                  onClick={startTwoFactorSetup}
                  disabled={securityLoading}
                  className="w-full bg-gradient-to-r from-violet-600 to-violet-500 py-3 rounded-2xl font-semibold disabled:opacity-60"
                >
                  {securityLoading ? 'Preparing...' : 'Enable 2FA'}
                </button>
              )}

              {twoFactorSetup && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20 p-4">
                    <img src={twoFactorSetup.qrDataUrl} alt="2FA QR code" className="w-full max-w-xs mx-auto rounded-xl" />
                  </div>
                  <div className="text-xs text-white/50 break-all">
                    Secret: <span className="font-mono text-white/80">{twoFactorSetup.secret}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3 tracking-[0.4em] text-center text-lg"
                    placeholder="123456"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={confirmTwoFactorSetup}
                      disabled={securityLoading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl font-semibold disabled:opacity-60"
                    >
                      {securityLoading ? 'Confirming...' : 'Confirm Code'}
                    </button>
                    <button
                      onClick={() => setTwoFactorSetup(null)}
                      className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {settings.twoFactorEnabled && (
                <button
                  onClick={disableTwoFactor}
                  disabled={securityLoading}
                  className="w-full mt-4 bg-red-600/90 hover:bg-red-600 py-3 rounded-2xl font-semibold disabled:opacity-60"
                >
                  {securityLoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-semibold">Audit Logs</h2>
              <button onClick={fetchAuditEvents} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm">
                Refresh
              </button>
            </div>

            {auditLoading ? (
              <div className="text-white/50">Loading logs...</div>
            ) : auditEvents.length === 0 ? (
              <div className="text-white/50">No audit events yet.</div>
            ) : (
              <div className="space-y-3">
                {auditEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="font-semibold">{event.action}</div>
                      <div className="text-xs text-white/40">{new Date(event.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-white/60">
                      <span>Actor: {event.actor}</span>
                      <span>Status: {event.status}</span>
                      <span>Severity: {event.severity}</span>
                      {event.ip && <span>IP: {event.ip}</span>}
                    </div>
                    {Object.keys(event.details || {}).length > 0 && (
                      <pre className="mt-3 text-xs text-white/50 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(event.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
