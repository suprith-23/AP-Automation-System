"use client";
import React from "react";

type WebhookTabProps = {
  canEdit: boolean;
  webhookEnabled: boolean;
  setWebhookEnabled: (v: boolean) => void;
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  webhookSecret: string;
  setWebhookSecret: (v: string) => void;
  webhookProvider: string;
  setWebhookProvider: (v: string) => void;
  webhookEvents: string[];
  setWebhookEvents: (v: string[]) => void;
  discordWebhookUrl: string;
  setDiscordWebhookUrl: (v: string) => void;
  notificationEvents: string[];
  setNotificationEvents: (v: string[]) => void;
  onSaveSettings: (sectionName: string) => Promise<void>;
};

const AVAILABLE_EVENTS = [
  "invoice.created",
  "invoice.processed",
  "invoice.approved",
  "invoice.rejected",
  "invoice.validation_failed",
  "invoice.irn_verified",
  "invoice.irn_rejected",
];

export default function WebhookTab({
  canEdit,
  webhookEnabled, setWebhookEnabled,
  webhookUrl, setWebhookUrl,
  webhookSecret, setWebhookSecret,
  webhookProvider, setWebhookProvider,
  webhookEvents, setWebhookEvents,
  discordWebhookUrl, setDiscordWebhookUrl,
  notificationEvents, setNotificationEvents,
  onSaveSettings,
}: WebhookTabProps) {
  
  const toggleEvent = (list: string[], setList: (v: string[]) => void, event: string) => {
    if (list.includes(event)) {
      setList(list.filter((e) => e !== event));
    } else {
      setList([...list, event]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-zinc-950 dark:text-white">
      {/* Sandbox & Webhook Configuration */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Webhook Integration</h3>
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="webhook-enabled"
              disabled={!canEdit}
              checked={webhookEnabled} 
              onChange={(e) => setWebhookEnabled(e.target.checked)} 
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 cursor-pointer disabled:opacity-50" 
            />
            <label htmlFor="webhook-enabled" className="text-xs font-bold text-zinc-600 dark:text-zinc-350 cursor-pointer select-none">
              Enable Canonical Webhooks
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Destination URL / Sandbox Endpoint</label>
            <input 
              type="url" 
              disabled={!canEdit}
              value={webhookUrl} 
              onChange={(e) => setWebhookUrl(e.target.value)} 
              placeholder="https://... or /api/v1/webhooks/sandbox"
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50 disabled:opacity-50" 
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">HMAC Secret Key (Optional)</label>
            <input 
              type="password" 
              disabled={!canEdit}
              value={webhookSecret} 
              onChange={(e) => setWebhookSecret(e.target.value)} 
              placeholder="Secret for SHA256 signature..."
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50 disabled:opacity-50" 
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Subscribed Events (M2M Webhooks)</label>
          <div className="grid grid-cols-3 gap-2">
            {AVAILABLE_EVENTS.map(evt => (
              <label key={`wh-${evt}`} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  disabled={!canEdit}
                  checked={webhookEvents.includes(evt)} 
                  onChange={() => toggleEvent(webhookEvents, setWebhookEvents, evt)} 
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 disabled:opacity-50" 
                />
                {evt}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Discord Notification Configuration */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Discord Notifications</h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">Discord Channel Webhook URL</label>
            <input 
              type="url" 
              disabled={!canEdit}
              value={discordWebhookUrl} 
              onChange={(e) => setDiscordWebhookUrl(e.target.value)} 
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#39E35D]/50 disabled:opacity-50" 
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Subscribed Alerts (Human Notifications)</label>
          <div className="grid grid-cols-3 gap-2">
            {AVAILABLE_EVENTS.map(evt => (
              <label key={`notif-${evt}`} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  disabled={!canEdit}
                  checked={notificationEvents.includes(evt)} 
                  onChange={() => toggleEvent(notificationEvents, setNotificationEvents, evt)} 
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-rose-500 disabled:opacity-50" 
                />
                {evt}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button disabled={!canEdit} onClick={() => onSaveSettings("Webhooks & Notifications")} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-xl shadow-sm transition-colors">
        Save Webhook Settings
      </button>
    </div>
  );
}
