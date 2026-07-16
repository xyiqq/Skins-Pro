import { html } from 'lit';
import type { TemplateResult } from 'lit';

import type { DashboardConfig, HomeAssistant, RenderedDevice, TranslationKey } from '../types';
import type { Language } from '../i18n';
import { assetKeyForDomain, deviceStateLabel, formatRelativeTime, selectedSkin, t } from '../utils';
import { renderImage } from '../render/context';

const HVAC_LABELS: Record<string, TranslationKey> = {
  auto: 'hvacAuto', cool: 'hvacCool', heat: 'hvacHeat',
  'fan_only': 'hvacFanOnly', dry: 'hvacDry', off: 'hvacOff',
};
const FAN_LABELS: Record<string, TranslationKey> = {
  auto: 'fanAuto', low: 'fanLow', medium: 'fanMedium',
  high: 'fanHigh', on: 'fanOn', off: 'fanOff',
};
const HVAC_ORDER = ['auto', 'cool', 'heat', 'fan_only', 'dry', 'off'];

function lab(mode: string, map: Record<string, TranslationKey>, lang: Language): string {
  const key = map[mode];
  return key ? t(lang, key) : mode;
}

export function renderClimateCard(
  config: DashboardConfig | undefined,
  hass: HomeAssistant,
  device: RenderedDevice,
  language: Language,
  onHandleAction: (entityId: string, action: string) => void,
): TemplateResult {
  const skin = selectedSkin(config);
  const assetKey = assetKeyForDomain(skin, 'climate');
  const stateObj = hass.states?.[device.entityId];

  if (!stateObj) {
    return html`<button class="device device-off" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">${renderImage(config, assetKey, device.name, 'item-img')}<div class="tag-stack"><div class="status">${deviceStateLabel(device.state, language, hass, 'climate')}</div></div></div>
      <div class="device-copy"><p class="device-name">${device.name}</p><p class="muted">${hass.states?.[device.entityId]?.last_changed ? formatRelativeTime(new Date(hass.states[device.entityId]!.last_changed), language) : device.subtitle}</p></div>
    </button>`;
  }

  const a = stateObj.attributes || {};
  const validHvacModes = new Set(['off', 'auto', 'cool', 'heat', 'dry', 'fan_only', 'heat_cool']);
  const hvacMode = (a.hvac_mode as string) || (validHvacModes.has(stateObj.state) ? stateObj.state : 'off');
  const currentTemp = a.current_temperature as number | undefined;
  const targetTemp = a.temperature as number | undefined;
  const hvacModes = ((a.hvac_modes as string[]) || []).filter(m => m !== 'heat_cool')
    .sort((x, y) => HVAC_ORDER.indexOf(x) - HVAC_ORDER.indexOf(y));
  const fanMode = a.fan_mode as string | undefined;
  const fanModes = (a.fan_modes as string[]) || [];
  const minT = (a.min_temp as number) ?? 16;
  const maxT = (a.max_temp as number) ?? 30;
  const step = (a.target_temp_step as number) ?? 1;

  const showFan = fanModes.length > 1;
  const statusClass = stateObj.state === 'unavailable' ? 'device-unavailable' : `device-on-${device.color}`;
  const stateForTime = hass.states?.[device.entityId];
const lastTime = stateForTime?.last_changed
  ? formatRelativeTime(new Date(stateForTime.last_changed), language)
  : undefined;

  const doService = (service: string, data: Record<string, unknown>) => {
    void hass.callService('climate', service, { entity_id: device.entityId, ...data });
  };

  const adjustTemp = (delta: number) => {
    const cur = targetTemp ?? minT;
    const next = Math.min(maxT, Math.max(minT, cur + delta));
    if (next !== cur) doService('set_temperature', { temperature: next });
  };

  const tempDisplay = (v?: number) => v !== undefined ? `${Math.round(v)}°` : '--';

  return html`
    <button class="device ${statusClass}" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">
        ${renderImage(config, assetKey, device.name, 'item-img')}
        <div class="tag-stack">
          <div class="status" style="font-size:var(--sp-font-4xs);font-weight:700">${currentTemp !== undefined ? tempDisplay(currentTemp) : lab(hvacMode, HVAC_LABELS, language)}</div>
        </div>
      </div>
      <div class="device-copy">
        <p class="device-name">${device.name}</p>
        <p class="muted">${lastTime || device.subtitle}</p>
      </div>
      <div class="control-row" style="gap:2px" @click=${(e: Event) => e.stopPropagation()}>
        <div style="display:flex;align-items:center;gap:1px;flex-shrink:0">
          <div class="media-volbtn" role="button" style="width:28px;height:32px;padding:0" @click=${(e: Event) => { e.stopPropagation(); adjustTemp(-step); }}><ha-icon icon="mdi:minus" style="--mdc-icon-size:14px"></ha-icon></div>
          <span style="font-weight:700;font-size:var(--sp-font-2xs);min-width:20px;text-align:center">${targetTemp !== undefined ? tempDisplay(targetTemp) : '--'}</span>
          <div class="media-volbtn" role="button" style="width:28px;height:32px;padding:0" @click=${(e: Event) => { e.stopPropagation(); adjustTemp(step); }}><ha-icon icon="mdi:plus" style="--mdc-icon-size:14px"></ha-icon></div>
        </div>
        <select class="filter-select" style="font-size:var(--sp-font-3xs);min-height:32px;min-width:48px;padding:0 16px 0 4px;background-size:8px;flex-shrink:0" @change=${(e: Event) => { e.stopPropagation(); doService('set_hvac_mode', { hvac_mode: (e.target as HTMLSelectElement).value }); }} @click=${(e: Event) => e.stopPropagation()}>
          ${hvacModes.map(m => html`<option value=${m} ?selected=${m === hvacMode}>${lab(m, HVAC_LABELS, language)}</option>`)}
        </select>
        ${showFan ? html`
        <select class="filter-select" style="font-size:var(--sp-font-3xs);min-height:32px;min-width:48px;padding:0 16px 0 4px;background-size:8px;flex-shrink:0" @change=${(e: Event) => { e.stopPropagation(); doService('set_fan_mode', { fan_mode: (e.target as HTMLSelectElement).value }); }} @click=${(e: Event) => e.stopPropagation()}>
          ${fanModes.map(m => html`<option value=${m} ?selected=${m === fanMode}>${lab(m, FAN_LABELS, language)}</option>`)}
        </select>` : ''}
      </div>
    </button>
  `;
}