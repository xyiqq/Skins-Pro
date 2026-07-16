import { html } from 'lit';
import type { TemplateResult } from 'lit';

import type { DashboardConfig, HomeAssistant, RenderedDevice, TranslationKey } from '../types';
import type { Language } from '../i18n';
import { assetKeyForDomain, deviceStateLabel, formatRelativeTime, selectedSkin, t } from '../utils';
import { renderImage } from '../render/context';

const MODE_LABELS: Record<string, TranslationKey> = {
  normal: 'hvacAuto', eco: 'presetEco', away: 'presetAway', boost: 'presetBoost',
  comfort: 'presetNone', home: 'home', sleep: 'presetSleep', auto: 'hvacAuto', baby: 'presetNone',
};

function modeLabel(mode: string, language: Language): string {
  const key = MODE_LABELS[mode];
  return key ? t(language, key) : mode;
}

export function renderHumidifierCard(
  config: DashboardConfig | undefined,
  hass: HomeAssistant,
  device: RenderedDevice,
  language: Language,
  onHandleAction: (entityId: string, action: string) => void,
): TemplateResult {
  const skin = selectedSkin(config);
  const assetKey = assetKeyForDomain(skin, 'humidifier');
  const stateObj = hass.states?.[device.entityId];

  if (!stateObj) {
    return html`<button class="device device-off" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">${renderImage(config, assetKey, device.name, 'item-img')}<div class="tag-stack"><div class="status">${deviceStateLabel(device.state, language, hass, 'humidifier')}</div></div></div>
      <div class="device-copy"><p class="device-name">${device.name}</p><p class="muted">${device.subtitle}</p></div>
    </button>`;
  }

  const a = stateObj.attributes || {};
  const isOn = stateObj.state === 'on';
  const isDehumidifier = (a.device_class as string) === 'dehumidifier';
  const targetHumidity = (a.target_humidity as number | undefined) ?? (a.humidity as number | undefined);
  const currentHumidity = a.current_humidity as number | undefined;
  const minH = (a.min_humidity as number) ?? 0;
  const maxH = (a.max_humidity as number) ?? 100;
  const step = (a.target_humidity_step as number) ?? 1;
  const mode = a.mode as string | undefined;
  const modes = (a.available_modes as string[]) || [];
  const action = a.action as string | undefined;

  const statusClass = isOn ? `device-on-${device.color}` : (stateObj.state === 'unavailable' ? 'device-unavailable' : 'device-off');
  const stateLabel = deviceStateLabel(stateObj.state, language, hass, 'humidifier');
  const lastTime = stateObj.last_changed ? formatRelativeTime(new Date(stateObj.last_changed), language) : device.subtitle;

  const actionLabel = (() => {
    if (!isOn) return undefined;
    if (action === 'humidifying') return t(language, 'humidifying');
    if (action === 'drying') return t(language, 'drying');
    if (action === 'idle' || action === 'off' || !action) return isDehumidifier ? t(language, 'drying') : t(language, 'humidifying');
    return undefined;
  })();

  const statusText = isOn && currentHumidity !== undefined ? `${Math.round(currentHumidity)}%` : stateLabel;
  const mutedText = actionLabel || lastTime;

  const doService = (service: string, data: Record<string, unknown>) => {
    void hass.callService('humidifier', service, { entity_id: device.entityId, ...data });
  };

  return html`
    <button class="device ${statusClass}" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top" @click=${(e: Event) => { e.stopPropagation(); onHandleAction(device.entityId, 'more-info'); }}>
        ${renderImage(config, assetKey, device.name, 'item-img')}
        <div class="tag-stack">
          <div class="status">${statusText}</div>
        </div>
      </div>
      <div class="device-copy">
        <p class="device-name">${device.name}</p>
        <p class="muted">${mutedText}</p>
      </div>
      <div class="control-row" style="gap:4px" @click=${(e: Event) => e.stopPropagation()}>
        ${isOn && targetHumidity !== undefined ? html`
        <div style="display:flex;align-items:center;gap:1px;flex-shrink:0">
          <div class="media-volbtn" role="button" style="width:28px;height:32px;padding:0" @click=${(e: Event) => { e.stopPropagation(); const next = Math.max(minH, targetHumidity - step); doService('set_humidity', { humidity: next }); }}><ha-icon icon="mdi:minus" style="--mdc-icon-size:14px"></ha-icon></div>
          <span style="font-weight:700;font-size:var(--sp-font-2xs);min-width:24px;text-align:center">${Math.round(targetHumidity)}%</span>
          <div class="media-volbtn" role="button" style="width:28px;height:32px;padding:0" @click=${(e: Event) => { e.stopPropagation(); const next = Math.min(maxH, targetHumidity + step); doService('set_humidity', { humidity: next }); }}><ha-icon icon="mdi:plus" style="--mdc-icon-size:14px"></ha-icon></div>
        </div>` : ''}
        ${isOn && modes.length > 0 ? html`
        <select class="filter-select" style="font-size:var(--sp-font-3xs);min-height:32px;min-width:48px;padding:0 16px 0 4px;background-size:8px;flex-shrink:0" @change=${(e: Event) => { e.stopPropagation(); doService('set_mode', { mode: (e.target as HTMLSelectElement).value }); }} @click=${(e: Event) => e.stopPropagation()}>
          ${modes.map(m => html`<option value=${m} ?selected=${m === mode}>${modeLabel(m, language)}</option>`)}
        </select>` : ''}
        <ha-control-switch .checked=${isOn} style="--control-switch-thickness:24px;--control-switch-border-radius:var(--sp-radius-pill);--control-switch-padding:3px;width:44px;flex-shrink:0;margin-left:auto" @change=${(e: Event) => { e.stopPropagation(); doService(isOn ? 'turn_off' : 'turn_on', {}); }} @click=${(e: Event) => e.stopPropagation()} .label=${device.name}></ha-control-switch>
      </div>
    </button>
  `;
}
