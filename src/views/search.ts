import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { RenderedDevice, DeviceColor } from '../types';
import type { TranslationKey } from '../types';
import type { RenderContext } from '../render/context';
import { renderDeviceCard } from '../components/device-card';
import { deviceTypeGroupKey } from '../selectors/devices';

const SEARCH_DOMAINS = /^(light|switch|climate|media_player|fan|humidifier|water_heater|cover|valve|vacuum|input_boolean|lock|alarm_control_panel|sensor|binary_sensor)\./;
const DEVICE_COLORS: DeviceColor[] = ['yellow', 'green', 'blue', 'purple', 'red', 'brown'];

const RECENT_KEY = 'skins-pro-search-recent';
const RECENT_MAX = 10;

const GROUP_LABELS: Record<string, TranslationKey> = {
  lights: 'groupLights',
  switches: 'groupSwitches',
  climate: 'groupClimate',
  covers: 'groupCovers',
  media: 'groupMedia',
  security: 'groupSecurity',
  cleaning: 'groupCleaning',
  others: 'groupOthers',
};

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(entityId: string): void {
  const recent = loadRecent().filter((id) => id !== entityId);
  recent.unshift(entityId);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_MAX)));
  } catch { /* ignore */ }
}

function buildSearchIndex(ctx: RenderContext): RenderedDevice[] {
  const hass = ctx.hass;
  if (!hass?.states) return [];

  const states = hass.states;
  let colorIdx = 0;
  const devices: RenderedDevice[] = [];

  for (const [entityId, stateObj] of Object.entries(states)) {
    if (!stateObj || !SEARCH_DOMAINS.test(entityId)) continue;
    if (stateObj.state === 'unavailable' || stateObj.state === 'unknown') continue;

    const domain = entityId.split('.')[0] || 'sensor';
    const attrs = stateObj.attributes as Record<string, unknown>;
    const name = String(attrs.friendly_name || entityId);
    const areaId = (attrs as { area_id?: string }).area_id || '';

    devices.push({
      entityId,
      name,
      subtitle: areaId || '',
      detail: domain,
      state: stateObj.state,
      icon: String(attrs.icon || ''),
      color: DEVICE_COLORS[colorIdx++ % DEVICE_COLORS.length]!,
    });
  }

  return devices;
}

function filterDevices(devices: RenderedDevice[], query: string, filter: string): RenderedDevice[] {
  let result = devices;

  if (filter !== 'all') {
    result = result.filter((d) => deviceTypeGroupKey(d.detail) === filter);
  }

  if (query.trim()) {
    const q = query.toLowerCase().trim();
    result = result.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.entityId.toLowerCase().includes(q) ||
      d.subtitle.toLowerCase().includes(q),
    );
  }

  return result;
}

export function renderSearchOverlay(
  ctx: RenderContext,
  query: string,
  filter: string,
  onQueryChange: (q: string) => void,
  onFilterChange: (f: string) => void,
): TemplateResult {
  const allDevices = buildSearchIndex(ctx);
  const filtered = filterDevices(allDevices, query, filter);

  const onDeviceAction = (entityId: string, action: string) => {
    saveRecent(entityId);
    ctx.onHandleAction(entityId, action);
  };

  const recentIds = loadRecent();
  const showRecent = !query.trim() && filter === 'all' && recentIds.length > 0;
  const recentDevices = showRecent
    ? recentIds
        .map((id) => allDevices.find((d) => d.entityId === id))
        .filter((d): d is RenderedDevice => Boolean(d))
    : [];

  const displayDevices = showRecent ? recentDevices : filtered;
  const isEmpty = displayDevices.length === 0;

  const groupCounts: Record<string, number> = {};
  for (const d of allDevices) {
    const g = deviceTypeGroupKey(d.detail);
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }
  const chips = [
    { key: 'all', label: ctx.translate('searchAll'), count: allDevices.length },
    ...Object.entries(groupCounts)
      .filter(([key]) => key !== 'others')
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({
        key,
        label: ctx.translate(GROUP_LABELS[key] || 'groupOthers'),
        count,
      })),
  ];

  const isLandscape = window.matchMedia('(orientation: landscape)').matches;

  return html`
    <div
      class="search-overlay"
      style="position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:rgba(0,0,0,0.3);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
      @click=${(e: Event) => { if (e.target === e.currentTarget) ctx.onCloseSearch(); }}
    >
      <div
        style="margin:auto;width:${isLandscape ? 'min(768px,92vw)' : '100vw'};max-height:80vh;display:flex;flex-direction:column;background:var(--sp-glass-bg,rgba(255,255,255,0.12));border:1px solid var(--sp-glass-border,rgba(255,255,255,0.18));border-radius:var(--sp-radius-card,20px);overflow:hidden;"
      >
        <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--sp-glass-border,rgba(255,255,255,0.1));">
          <ha-icon icon="mdi:magnify" style="color:var(--sp-text-primary,#fff);--mdc-icon-size:24px;flex-shrink:0;"></ha-icon>
          <input
            type="text"
            .value=${query}
            placeholder=${ctx.translate('searchPlaceholder')}
            style="flex:1;border:none;background:transparent;color:var(--sp-text-primary,#fff);font-size:18px;outline:none;"
            @input=${(e: Event) => onQueryChange((e.target as HTMLInputElement).value)}
            autofocus
          >
          <ha-icon
            icon="mdi:close"
            style="color:var(--sp-text-primary,#fff);--mdc-icon-size:24px;flex-shrink:0;cursor:pointer;opacity:0.7;"
            @click=${() => ctx.onCloseSearch()}
          ></ha-icon>
        </div>

        <div style="display:flex;gap:8px;padding:12px 20px;overflow-x:auto;-webkit-overflow-scrolling:touch;border-bottom:1px solid var(--sp-glass-border,rgba(255,255,255,0.08));">
          ${chips.map((chip) => html`
            <button
              style="flex-shrink:0;display:flex;align-items:center;gap:4px;padding:8px 16px;border:none;border-radius:var(--sp-radius-pill,999px);font-size:14px;cursor:pointer;transition:all 0.2s;background:${filter === chip.key ? 'var(--sp-accent,#007aff)' : 'var(--sp-chip-bg,rgba(255,255,255,0.1))'};color:${filter === chip.key ? '#fff' : 'var(--sp-text-primary,#fff)'};"
              @click=${() => onFilterChange(chip.key)}
            >${chip.label}<span style="opacity:0.6;font-size:12px;">${chip.count}</span></button>
          `)}
        </div>

        <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 20px;">
          ${showRecent && recentDevices.length > 0 ? html`
            <p style="color:var(--sp-text-secondary,rgba(255,255,255,0.5));font-size:13px;margin:0 0 12px 0;">${ctx.translate('searchRecent')}</p>
          ` : nothing}

          ${isEmpty ? html`
            <div style="text-align:center;padding:40px 0;color:var(--sp-text-secondary,rgba(255,255,255,0.4));">
              <ha-icon icon="mdi:magnify-close" style="--mdc-icon-size:48px;opacity:0.3;"></ha-icon>
              <p style="margin:12px 0 0 0;font-size:15px;">${ctx.translate('searchNoResults')}</p>
            </div>
          ` : html`
            <div style="display:grid;grid-template-columns:${isLandscape ? 'repeat(2,1fr)' : '1fr'};gap:12px;">
              ${displayDevices.map((device) => renderDeviceCard(ctx.config, ctx.hass, device, ctx.language, onDeviceAction))}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
