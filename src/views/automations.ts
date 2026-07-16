import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type { HassEntity } from '../types';
import type { RenderContext } from '../render/context';
import { renderPageShell } from '../components/page-shell';
import { renderImage } from '../render/context';
import { assetKeyForDomain, deviceStateLabel, formatRelativeTime, selectedSkin, t } from '../utils';

export function renderAutomationsView(ctx: RenderContext): TemplateResult {
  const automations = renderRealAutomations(ctx);
  return renderPageShell(
    ctx.translate('automations'),
    t(ctx.language, 'automationsSubtitle'),
    html``,
    automations !== nothing
      ? html`<div class="page-scroll themed-scrollbar"><div class="devices devices-page-grid automations-grid">${automations}</div></div>`
      : html`<div class="empty-state">${ctx.translate('noAutomations')}</div>`
  );
}

function renderRealAutomations(ctx: RenderContext): TemplateResult | typeof nothing {
  const automations = Object.values(ctx.hass.states)
    .filter((entity): entity is HassEntity => Boolean(entity?.entity_id?.startsWith('automation.')));

  if (automations.length === 0) return nothing;

  const skin = selectedSkin(ctx.config);
  const assetKey = assetKeyForDomain(skin, 'automation');

  return html`${automations.map((automation, index) => {
    const stateLabel = deviceStateLabel(automation.state, ctx.language, ctx.hass, 'automation');
    const active = automation.state === 'on';
    const tones: Array<'green' | 'blue' | 'purple' | 'yellow'> = ['green', 'blue', 'purple', 'yellow'];
    const statusClass = active ? `device-on-${tones[index % tones.length]}` : 'device-off';
    const lastTriggered = automation.attributes?.last_triggered
      ? formatRelativeTime(new Date(automation.attributes.last_triggered as string), ctx.language)
      : t(ctx.language, 'notTriggered');
    const name = String(automation.attributes?.friendly_name || automation.entity_id);

    return html`
      <button class="device ${statusClass}" @click=${() => ctx.onHandleAction(automation.entity_id, 'more-info')}>
        <div class="device-top">
          ${renderImage(ctx.config, assetKey, 'Automation', 'item-img')}
          <div class="tag-stack"><div class="status">${stateLabel}</div></div>
        </div>
        <div class="device-copy"><p class="device-name">${name}</p><p class="muted">${lastTriggered}</p></div>
        <div class="control-row"><span class="state-word">${t(ctx.language, active ? 'enabled' : 'disabled')}</span><ha-control-switch .checked=${active} style="--control-switch-thickness:24px;--control-switch-border-radius:var(--sp-radius-pill);--control-switch-padding:3px;width:44px;flex-shrink:0" @click=${(e: Event) => e.stopPropagation()} @change=${(e: Event) => { e.stopPropagation(); ctx.onHandleAction(automation.entity_id, 'toggle'); }} .label=${name}></ha-control-switch></div>
      </button>
    `;
  })}`;
}
