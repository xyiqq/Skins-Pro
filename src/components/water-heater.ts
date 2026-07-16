import { html } from 'lit';
import type { TemplateResult } from 'lit';

import type { DashboardConfig, HomeAssistant, RenderedDevice, TranslationKey } from '../types';
import type { Language } from '../i18n';
import { assetKeyForDomain, deviceStateLabel, formatRelativeTime, selectedSkin, t } from '../utils';
import { renderImage } from '../render/context';

const OP_LABELS: Record<string, TranslationKey> = {
  auto: 'hvacAuto', eco: 'presetEco', electric: 'presetNone',
  performance: 'presetBoost', 'high demand': 'presetBoost',
  'heat pump': 'presetNone', gas: 'presetNone', off: 'hvacOff',
  'away': 'presetAway',
};

function opLabel(mode: string, language: Language): string {
  const key = OP_LABELS[mode];
  return key ? t(language, key) : mode;
}

export function renderWaterHeaterCard(
  config: DashboardConfig | undefined,
  hass: HomeAssistant,
  device: RenderedDevice,
  language: Language,
  onHandleAction: (entityId: string, action: string) => void,
): TemplateResult {
  const skin = selectedSkin(config);
  const assetKey = assetKeyForDomain(skin, 'water_heater');
  const stateObj = hass.states?.[device.entityId];

  if (!stateObj) {
    return html`<button class="device device-off" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">${renderImage(config, assetKey, device.name, 'item-img')}<div class="tag-stack"><div class="status">${deviceStateLabel(device.state, language, hass, 'water_heater')}</div></div></div>
      <div class="device-copy"><p class="device-name">${device.name}</p><p class="muted">${device.subtitle}</p></div>
    </button>`;
  }

  const a = stateObj.attributes || {};
  const isOff = stateObj.state === 'off';
  const currentTemp = a.current_temperature as number | undefined;
  const targetTemp = a.temperature as number | undefined;
  const operationMode = (a.operation_mode as string) || stateObj.state;
  const operationList = (a.operation_list as string[]) || [];
  const minT = (a.min_temp as number) ?? 43;
  const maxT = (a.max_temp as number) ?? 65;
  const step = (a.target_temp_step as number) ?? 1;

  const statusClass = stateObj.state === 'unavailable' ? 'device-unavailable' : `device-on-${device.color}`;
  const lastTime = stateObj.last_changed ? formatRelativeTime(new Date(stateObj.last_changed), language) : device.subtitle;

  const tempDisplay = (v?: number) => v !== undefined ? `${Math.round(v)}°` : '--';

  const doService = (service: string, data: Record<string, unknown>) => {
    void hass.callService('water_heater', service, { entity_id: device.entityId, ...data });
  };

  const adjustTemp = (delta: number) => {
    const cur = targetTemp ?? minT;
    const next = Math.min(maxT, Math.max(minT, cur + delta));
    if (next !== cur) doService('set_temperature', { temperature: next });
  };

  return html`
    <button class="device ${statusClass}" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">
        ${renderImage(config, assetKey, device.name, 'item-img')}
        <div class="tag-stack">
          <div class="status" style="font-size:var(--sp-font-4xs);font-weight:700">${currentTemp !== undefined ? tempDisplay(currentTemp) : deviceStateLabel(stateObj.state, language, hass, 'water_heater')}</div>
        </div>
      </div>
      <div class="device-copy">
        <p class="device-name">${device.name}</p>
        <p class="muted">${lastTime}</p>
      </div>
      <div class="control-row" style="gap:2px" @click=${(e: Event) => e.stopPropagation()}>
        <div style="display:flex;align-items:center;gap:1px;flex-shrink:0">
          <div class="media-volbtn" role="button" style="width:28px;height:32px;padding:0" @click=${(e: Event) => { e.stopPropagation(); adjustTemp(-step); }}><ha-icon icon="mdi:minus" style="--mdc-icon-size:14px"></ha-icon></div>
          <span style="font-weight:700;font-size:var(--sp-font-2xs);min-width:22px;text-align:center">${targetTemp !== undefined ? tempDisplay(targetTemp) : '--'}</span>
          <div class="media-volbtn" role="button" style="width:28px;height:32px;padding:0" @click=${(e: Event) => { e.stopPropagation(); adjustTemp(step); }}><ha-icon icon="mdi:plus" style="--mdc-icon-size:14px"></ha-icon></div>
        </div>
        ${operationList.length > 1 ? html`
        <select class="filter-select" style="font-size:var(--sp-font-3xs);min-height:32px;min-width:48px;padding:0 16px 0 4px;background-size:8px;flex-shrink:0" @change=${(e: Event) => { e.stopPropagation(); doService('set_operation_mode', { operation_mode: (e.target as HTMLSelectElement).value }); }} @click=${(e: Event) => e.stopPropagation()}>
          ${operationList.map(m => html`<option value=${m} ?selected=${m === operationMode}>${opLabel(m, language)}</option>`)}
        </select>` : ''}
        <ha-control-switch .checked=${!isOff} style="--control-switch-thickness:24px;--control-switch-border-radius:var(--sp-radius-pill);--control-switch-padding:3px;width:44px;flex-shrink:0;margin-left:auto" @change=${(e: Event) => { e.stopPropagation(); doService(isOff ? 'turn_on' : 'turn_off', {}); }} @click=${(e: Event) => e.stopPropagation()} .label=${device.name}></ha-control-switch>
      </div>
    </button>
  `;
}
