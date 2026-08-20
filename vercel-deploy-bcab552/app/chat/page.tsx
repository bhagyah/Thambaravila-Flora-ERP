'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  recipientId?: string | null;
  recipientName?: string | null;
  channel: string;
  content: string;
  attachmentUrl: string | null;
  sentAt: string;
}

export default function InternalChatPage() {
  const { data: session } = useSession();
  const [channel, setChannel] = useState('general');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  // Direct messaging recipient state
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) {
      fetchChatUsers();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchMessages(true);

      // Real-time live polling every 1.5 seconds
      const interval = setInterval(() => {
        fetchMessages(false);
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [session, channel, selectedRecipientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatUsers = async () => {
    try {
      const res = await fetch('/api/chat/users');
      if (res.ok) {
        const data = await res.json();
        setTeamUsers(data.users || []);
        setRoles(data.roles || []);
      }
    } catch (e) {
      console.error('Failed to fetch chat users', e);
    }
  };

  const fetchMessages = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const url = channel === 'direct' && selectedRecipientId
        ? `/api/chat?channel=direct&recipientId=${selectedRecipientId}`
        : `/api/chat?channel=${channel}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to fetch chat messages', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !session) return;

    const messageContent = content.trim();
    setContent('');

    const recipientUser = selectedRecipientId ? teamUsers.find(u => u.id === selectedRecipientId) : null;

    // Optimistic UI update
    const tempMessage: ChatMessageItem = {
      id: `temp-${Date.now()}`,
      senderId: session.user.id,
      senderName: session.user.name || 'Team Member',
      recipientId: selectedRecipientId,
      recipientName: recipientUser?.name,
      channel,
      content: messageContent,
      attachmentUrl: null,
      sentAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          content: messageContent,
          recipientId: selectedRecipientId,
          recipientName: recipientUser?.name,
        }),
      });

      if (res.ok) {
        fetchMessages(false);
      }
    } catch (e) {
      console.error('Failed to send chat message', e);
    }
  };

  if (!session) return null;

  const roleName = session.user?.role?.name || '';
  const isOwnerOrIT = roleName === 'Owner' || roleName === 'IT/Admin';

  // Available Channels
  const availableChannels = [
    { id: 'general', label: '📢 # General Team', allowed: true },
    { id: 'sales', label: '💼 # Sales Dept', allowed: isOwnerOrIT || roleName === 'Sales Manager' },
    { id: 'accountant', label: '💳 # Accounts Dept', allowed: isOwnerOrIT || roleName === 'Accountant' },
    { id: 'coordinator', label: '🗓️ # Events & Coordinator', allowed: isOwnerOrIT || roleName === 'Wedding Coordinator' },
  ].filter(c => c.allowed);

  const activeRecipient = teamUsers.find(u => u.id === selectedRecipientId);

  // Target Selector options list
  const otherUsers = teamUsers.filter(u => u.id !== session.user.id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-flora-dark/95 border border-flora-border rounded-3xl shadow-2xl grid grid-cols-1 md:grid-cols-4 h-[82vh] overflow-hidden backdrop-blur-md">
        {/* Left Sidebar Channels & Direct Messages */}
        <div className="bg-flora-darker border-r border-flora-border p-4 text-white flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">Team Channels</h2>
              <span className="w-2.5 h-2.5 rounded-full bg-flora-sage animate-pulse" title="Live Synced"></span>
            </div>

            {/* Public Channels */}
            <nav className="space-y-1 text-xs font-semibold">
              {availableChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setChannel(ch.id);
                    setSelectedRecipientId(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl capitalize transition flex items-center justify-between ${
                    channel === ch.id && !selectedRecipientId
                      ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-black shadow'
                      : 'text-slate-300 hover:bg-flora-card hover:text-white'
                  }`}
                >
                  <span>{ch.label}</span>
                  {channel === ch.id && !selectedRecipientId && (
                    <span className="text-[10px] bg-slate-950/40 px-1.5 py-0.5 rounded text-slate-950 font-bold">LIVE</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Direct Messages (1-on-1) List by Staff Role */}
            <div className="pt-3 border-t border-flora-border">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <span>Direct Messages (1-on-1)</span>
                <span className="text-flora-sage font-mono">{otherUsers.length} Staff</span>
              </div>

              <div className="space-y-1 mt-2 text-xs">
                {otherUsers.length === 0 ? (
                  <div className="px-2 py-3 text-slate-500 text-[11px] italic">Loading team members...</div>
                ) : (
                  otherUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setChannel('direct');
                        setSelectedRecipientId(u.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl transition flex items-center space-x-2.5 ${
                        selectedRecipientId === u.id
                          ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-black shadow'
                          : 'text-slate-300 hover:bg-flora-card hover:text-white'
                      }`}
                    >
                      <span className="text-base">{u.avatarUrl || '👤'}</span>
                      <div className="truncate flex-1">
                        <div className="truncate font-bold">{u.name}</div>
                        <div className="text-[10px] text-flora-sage font-medium truncate">{u.roleName}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 border-t border-flora-border pt-3 px-2 flex justify-between items-center">
            <span>Role: <strong className="text-flora-sage">{roleName}</strong></span>
          </div>
        </div>

        {/* Main Chat Window */}
        <div className="md:col-span-3 flex flex-col h-full bg-flora-dark">
          {/* Header */}
          <div className="bg-flora-darker px-6 py-4 border-b border-flora-border flex justify-between items-center text-white">
            <div>
              <h3 className="font-extrabold text-slate-100 text-sm capitalize flex items-center space-x-2">
                <span>💬</span>
                <span>
                  {selectedRecipientId
                    ? `Private 1-on-1 Chat with ${activeRecipient?.name || 'Staff Member'} (${activeRecipient?.roleName})`
                    : `#${channel} Channel`}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedRecipientId
                  ? `Direct confidential message sent directly to ${activeRecipient?.name}`
                  : 'Live team channel updated in real time without refreshing'}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 text-xs text-flora-sage font-bold">
                <span className="w-2 h-2 rounded-full bg-flora-sage animate-pulse"></span>
                <span className="hidden sm:inline">Live Synced</span>
              </div>

              {/* Explicit Close Button */}
              <Link
                href="/dashboard"
                className="px-3 py-1.5 bg-flora-card hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-flora-border transition flex items-center space-x-1"
                title="Close Chat Desk"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Close</span>
              </Link>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {loading ? (
              <div className="text-center text-slate-400 text-xs animate-pulse">Loading live messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-16">
                No messages yet in this conversation. Use the target selector below to send a message!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === session.user.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="text-[10px] text-slate-400 font-semibold mb-1 px-1 flex items-center space-x-1.5">
                      <span>{msg.senderName}</span>
                      {msg.recipientName && (
                        <>
                          <span>➔</span>
                          <span className="text-flora-sage">{msg.recipientName}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-lg transition-all ${
                        isMe
                          ? 'bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-bold rounded-br-none'
                          : 'bg-flora-darker text-slate-100 border border-flora-border rounded-bl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Target Role & Recipient Composer Panel */}
          <form onSubmit={handleSendMessage} className="p-4 bg-flora-darker border-t border-flora-border space-y-3">
            {/* Target Role / Recipient Selector Bar */}
            <div className="flex flex-wrap items-center gap-3 text-xs bg-flora-dark p-2 rounded-xl border border-flora-border">
              <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                <span>🎯</span>
                <span>Send To Target:</span>
              </span>

              <select
                value={selectedRecipientId ? `user:${selectedRecipientId}` : `channel:${channel}`}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('channel:')) {
                    setChannel(val.replace('channel:', ''));
                    setSelectedRecipientId(null);
                  } else if (val.startsWith('user:')) {
                    setChannel('direct');
                    setSelectedRecipientId(val.replace('user:', ''));
                  }
                }}
                className="px-3 py-1.5 bg-flora-darker border border-flora-border text-flora-sage font-extrabold rounded-lg outline-none focus:border-flora-sage"
              >
                <optgroup label="Public & Dept Channels">
                  {availableChannels.map(c => (
                    <option key={c.id} value={`channel:${c.id}`}>{c.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Direct Message by Staff Role">
                  {otherUsers.map(u => (
                    <option key={u.id} value={`user:${u.id}`}>👤 {u.name} ({u.roleName})</option>
                  ))}
                </optgroup>
              </select>

              <span className="text-[11px] text-slate-400">
                {selectedRecipientId
                  ? `Private message to ${activeRecipient?.name} (${activeRecipient?.roleName})`
                  : `Channel broadcast to #${channel}`}
              </span>
            </div>

            {/* Input Row */}
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={selectedRecipientId ? `Type confidential message for ${activeRecipient?.name}...` : `Type message in #${channel}...`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 bg-flora-dark border border-flora-border rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-flora-sage outline-none font-medium"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-flora-green to-flora-sage text-slate-950 font-black text-xs rounded-xl shadow-lg hover:from-flora-sage hover:to-flora-green transition flex items-center space-x-1.5"
              >
                <span>Send Live</span>
                <span>➔</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
