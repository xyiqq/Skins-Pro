import { html } from 'lit';
import type { TemplateResult } from 'lit';

import type { DashboardConfig, HomeAssistant, RenderedDevice, TranslationKey } from '../types';
import type { Language } from '../i18n';
import { assetKeyForDomain, formatRelativeTime, selectedSkin, t } from '../utils';
import { renderImage } from '../render/context';
import { setAlarmMode } from './alarm-code-dialog';

const ALARM_STATE_LABELS: Record<string, TranslationKey> = {
  disarmed: 'alarmDisarmed',
  armed_home: 'alarmArmedHome',
  armed_away: 'alarmArmedAway',
  armed_night: 'alarmArmedNight',
  armed_vacation: 'alarmArmedVacation',
  armed_custom_bypass: 'alarmArmedCustom',
  arming: 'alarmArming',
  pending: 'alarmPending',
  triggered: 'alarmTriggered',
  disarming: 'alarmDisarming',
};

export function alarmStateLabel(state: string, language: Language): string {
  const key = ALARM_STATE_LABELS[state];
  return key ? t(language, key) : state;
}

export function renderAlarmControlPanelCard(
  config: DashboardConfig | undefined,
  hass: HomeAssistant,
  device: RenderedDevice,
  language: Language,
  onHandleAction: (entityId: string, action: string) => void,
): TemplateResult {
  const skin = selectedSkin(config);
  const assetKey = assetKeyForDomain(skin, alarmAssetDomain(skin));
  const stateObj = hass.states?.[device.entityId];

  if (!stateObj) {
    return html`<button class="device device-off" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">${renderImage(config, assetKey, device.name, 'item-img')}<div class="tag-stack"><div class="status">${alarmStateLabel(device.state, language)}</div></div></div>
      <div class="device-copy"><p class="device-name">${device.name}</p><p class="muted">${device.subtitle}</p></div>
    </button>`;
  }

  const state = stateObj.state;
  const attrs = stateObj.attributes || {};
  const isArmed = state === 'armed_home' || state === 'armed_away' || state === 'armed_night' || state === 'armed_vacation' || state === 'armed_custom_bypass';
  const isTriggered = state === 'triggered';
  const isPending = state === 'pending' || state === 'arming' || state === 'disarming';

  const statusClass: string = isTriggered ? `device-on-red` : (isArmed ? `device-on-${device.color}` : (isPending ? `device-on-${device.color}` : (state === 'unavailable' ? 'device-unavailable' : 'device-off')));
  const lastTime = stateObj.last_changed ? formatRelativeTime(new Date(stateObj.last_changed), language) : device.subtitle;

  const supportedFeatures = (attrs.supported_features as number) || 0;

  const FEATURE_ARM_HOME = 1;
  const FEATURE_ARM_AWAY = 2;
  const FEATURE_ARM_NIGHT = 4;
  const FEATURE_ARM_VACATION = 16;

  type ArmMode = { feature: number; icon: string; service: string; title: string };
  const armModes: ArmMode[] = [
    { feature: FEATURE_ARM_AWAY, icon: 'mdi:shield-lock', service: 'alarm_arm_away', title: t(language, 'alarmArmedAway') },
    { feature: FEATURE_ARM_HOME, icon: 'mdi:shield-home', service: 'alarm_arm_home', title: t(language, 'alarmArmedHome') },
    { feature: FEATURE_ARM_NIGHT, icon: 'mdi:shield-moon', service: 'alarm_arm_night', title: t(language, 'alarmArmedNight') },
    { feature: FEATURE_ARM_VACATION, icon: 'mdi:shield-airplane', service: 'alarm_arm_vacation', title: t(language, 'alarmArmedVacation') },
  ];
  const availableArms = armModes.filter(m => supportedFeatures & m.feature);
  const fallbackArms = availableArms.length > 0 ? availableArms : armModes.slice(0, 2);

  const iconStyle = '--mdc-icon-size:18px;color:var(--sp-text-primary);display:flex;cursor:pointer';

  const armButtons = (!isTriggered && !isPending)
    ? fallbackArms.slice(0, 3).map(m => html`
        <ha-icon icon=${m.icon} style=${iconStyle} title=${m.title} @click=${(e: Event) => { e.stopPropagation(); void setAlarmMode(e.currentTarget as HTMLElement, hass, device.entityId, m.service, false); }}></ha-icon>
      `)
    : '';

  const disarmButton = (isArmed || isTriggered)
    ? html`<ha-icon icon="mdi:shield-off" style=${iconStyle} title=${t(language, 'alarmDisarmed')} @click=${(e: Event) => { e.stopPropagation(); void setAlarmMode(e.currentTarget as HTMLElement, hass, device.entityId, 'alarm_disarm', true); }}></ha-icon>`
    : '';

  const controlIcons = isPending ? html`<ha-icon icon=${isTriggered ? 'mdi:bell-ring' : (isArmed ? 'mdi:shield-lock' : 'mdi:shield-off')} style="--mdc-icon-size:18px;color:var(--sp-text-primary)"></ha-icon>` : html`${armButtons}${disarmButton}`;

  return html`
    <button class="device ${statusClass}" @click=${() => onHandleAction(device.entityId, 'more-info')}>
      <div class="device-top">
        ${renderImage(config, assetKey, device.name, 'item-img')}
        <div class="tag-stack">
          <div class="status">${alarmStateLabel(state, language)}</div>
        </div>
      </div>
      <div class="device-copy">
        <p class="device-name">${device.name}</p>
        <p class="muted">${lastTime}</p>
      </div>
      <div class="control-row" style="justify-content:flex-end;gap:6px" @click=${(e: Event) => e.stopPropagation()}>
        ${controlIcons}
      </div>
    </button>
  `;
}

function alarmAssetDomain(skin: string): string {
  void skin;
  return 'alarm_control_panel';
}
