import { html } from 'lit';
import type { TemplateResult } from 'lit';

import type { DashboardConfig, HomeAssistant, RenderedDevice, TranslationKey } from '../types';
import type { Language } from '../i18n';
import { assetKeyForDomain, deviceStateLabel, formatRelativeTime, selectedSkin, t } from '../utils';
import { renderImage } from '../render/context';

export function renderFanCard(
  config: DashboardConfig | undefined,
  hass: HomeAssistant,
  device: RenderedDevice,
  language: Language,
  onHandleAction: (entityId: string, action: string) => void,
): TemplateResult {
  const skin = selectedSkin(config);
  const assetKey = assetKeyForDomain(skin, 'fan');
  const stateObj = hass.states?.[device.entityId];

  if (!stateObj) {
    return html`<button class="device device-off" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">${renderImage(config, assetKey, device.name, 'item-img')}<div class="tag-stack"><div class="status">${deviceStateLabel(device.state, language, hass, 'fan')}</div></div></div>
      <div class="device-copy"><p class="device-name">${device.name}</p><p class="muted">${device.subtitle}</p></div>
    </button>`;
  }

  const a = stateObj.attributes || {};
  const isOn = stateObj.state === 'on';
  const percentage = a.percentage as number | undefined;
  const percentageStep = (a.percentage_step as number) ?? 1;
  const presetMode = a.preset_mode as string | undefined;
  const presetModes = (a.preset_modes as string[]) || [];
  const oscillating = a.oscillating as boolean | undefined;
  const currentDirection = a.current_direction as string | undefined;

  const statusClass = isOn ? `device-on-${device.color}` : (stateObj.state === 'unavailable' ? 'device-unavailable' : 'device-off');
  const stateLabel = deviceStateLabel(stateObj.state, language, hass, 'fan');
  const lastTime = stateObj.last_changed ? formatRelativeTime(new Date(stateObj.last_changed), language) : device.subtitle;

  const doService = (service: string, data: Record<string, unknown>) => {
    void hass.callService('fan', service, { entity_id: device.entityId, ...data });
  };

  return html`
    <button class="device ${statusClass}" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top" @click=${(e: Event) => { e.stopPropagation(); onHandleAction(device.entityId, 'more-info'); }}>
        ${renderImage(config, assetKey, device.name, 'item-img')}
        <div class="tag-stack">
          <div class="status">${isOn && percentage !== undefined && percentage > 0 ? `${percentage}%` : stateLabel}</div>
        </div>
      </div>
      <div class="device-copy">
        <p class="device-name">${device.name}</p>
        <p class="muted">${lastTime}</p>
      </div>
      <div class="control-row" style="gap:4px" @click=${(e: Event) => e.stopPropagation()}>
        ${isOn && percentage !== undefined ? html`
        <ha-control-slider .value=${percentage} min="0" max="100" step=${percentageStep} style="--control-slider-thickness:28px;--control-slider-border-radius:var(--sp-radius-pill);flex:1;min-width:0" @value-changed=${(e: CustomEvent) => { e.stopPropagation(); const v = (e.detail.value ?? 0) as number; if (v === 0) { doService('turn_off', {}); } else { doService('set_percentage', { percentage: v }); } }} @click=${(e: Event) => e.stopPropagation()}></ha-control-slider>
        ` : ''}
        ${isOn && presetModes.length > 0 ? html`
        <select class="filter-select" style="font-size:var(--sp-font-3xs);min-height:32px;min-width:48px;padding:0 16px 0 4px;background-size:8px;flex-shrink:0" @change=${(e: Event) => { e.stopPropagation(); doService('set_preset_mode', { preset_mode: (e.target as HTMLSelectElement).value }); }} @click=${(e: Event) => e.stopPropagation()}>
          ${presetModes.map(m => html`<option value=${m} ?selected=${m === presetMode}>${fanPresetLabel(m, language)}</option>`)}
        </select>` : ''}
        ${isOn && oscillating !== undefined ? html`
        <div class="media-volbtn" role="button" style="width:32px;height:32px;padding:0;flex-shrink:0" title=${t(language, 'fanOscillate')} @click=${(e: Event) => { e.stopPropagation(); doService('oscillate', { oscillating: !oscillating }); }}><ha-icon icon=${oscillating ? 'mdi:rotate-3d-variant' : 'mdi:rotate-360'} style="--mdc-icon-size:14px"></ha-icon></div>` : ''}
        ${isOn && currentDirection !== undefined ? html`
        <div class="media-volbtn" role="button" style="width:32px;height:32px;padding:0;flex-shrink:0" title=${t(language, 'fanDirection')} @click=${(e: Event) => { e.stopPropagation(); doService('set_direction', { direction: currentDirection === 'forward' ? 'reverse' : 'forward' }); }}><ha-icon icon=${currentDirection === 'reverse' ? 'mdi:reload' : 'mdi:swap-vertical'} style="--mdc-icon-size:14px"></ha-icon></div>` : ''}
        <ha-control-switch .checked=${isOn} style="--control-switch-thickness:24px;--control-switch-border-radius:var(--sp-radius-pill);--control-switch-padding:3px;width:44px;flex-shrink:0;margin-left:auto" @change=${(e: Event) => { e.stopPropagation(); doService(isOn ? 'turn_off' : 'turn_on', {}); }} @click=${(e: Event) => e.stopPropagation()} .label=${device.name}></ha-control-switch>
      </div>
    </button>
  `;
}

const FAN_PRESET_LABELS: Record<string, TranslationKey> = {
  auto: 'fanAuto', low: 'fanLow', medium: 'fanMedium', high: 'fanHigh', on: 'fanOn', off: 'fanOff',
};

function fanPresetLabel(mode: string, language: Language): string {
  const key = FAN_PRESET_LABELS[mode];
  return key ? t(language, key) : mode;
}
