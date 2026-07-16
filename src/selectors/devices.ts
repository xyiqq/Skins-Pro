import type {
  AreaRegistryEntry,
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HomeAssistant,
  RenderedDevice,
} from '../types';
import { iconForDomain } from '../utils';
import { areaNameForEntity } from './areas';

const DEVICE_COLORS: RenderedDevice['color'][] = ['yellow', 'green', 'blue', 'purple', 'red', 'brown'];

const PREFERRED_DOMAINS = /^(light|switch|climate|media_player|lock|cover|fan|valve|input_boolean|humidifier|water_heater|vacuum)\./;

export interface DeviceFilters {
  filterRoom?: string;
  filterType?: string;
  hideUnassigned?: boolean;
}

export function getRealDevicesForRender(
  hass: HomeAssistant | undefined,
  deviceRegistry: DeviceRegistryEntry[] | undefined,
  entityRegistry: EntityRegistryEntry[] | undefined,
  areas: AreaRegistryEntry[] | undefined,
  filters: DeviceFilters = {},
): RenderedDevice[] {
  if (!deviceRegistry || !entityRegistry || !hass) return [];

  return deviceRegistry
    .filter((device) => !device.disabled_by)
    .map((device, index) => {
      const entities = entityRegistry
        ?.filter((entry) => entry.device_id === device.id && !entry.hidden_by && !entry.disabled_by)
        .map((entry) => entry.entity_id) || [];
      if (entities.length === 0) return undefined;

      const nonUpdateEntities = entities.filter((entityId) => !entityId.startsWith('update.') && !entityId.startsWith('device_tracker.'));
      if (nonUpdateEntities.length === 0) return undefined;
      const preferredEntity = nonUpdateEntities.find((entityId) => PREFERRED_DOMAINS.test(entityId)) || nonUpdateEntities[0];
      if (!preferredEntity || !hass) return undefined;

      const stateObj = hass.states[preferredEntity];
      const state = stateObj?.state || 'unknown';
      const domain = preferredEntity.split('.')[0] || 'sensor';
      const icon = String(stateObj?.attributes?.icon || iconForDomain(domain));
      const name = String(stateObj?.attributes?.friendly_name || preferredEntity);
      const subtitle = areaNameForEntity(preferredEntity, entityRegistry, deviceRegistry, areas) || '';
      const detail = domain || '--';

      return {
        entityId: preferredEntity,
        name,
        subtitle,
        detail,
        state,
        icon,
        color: DEVICE_COLORS[index % DEVICE_COLORS.length]!,
      };
    })
    .filter((device): device is RenderedDevice => Boolean(device))
    .filter((d) => {
      if (filters.filterRoom && d.subtitle !== filters.filterRoom) return false;
      if (filters.filterType && deviceTypeGroupKey(d.detail) !== filters.filterType) return false;
      if (filters.hideUnassigned && !d.subtitle) return false;
      return true;
    });
}

export function deviceTypeGroupKey(detail: string): string {
  return DEVICE_DOMAIN_GROUP[detail] || 'others';
}

export function getDeviceRooms(devices: RenderedDevice[]): string[] {
  return [...new Set(devices.map((d) => d.subtitle).filter(Boolean))].sort();
}

export function getDeviceTypes(devices: RenderedDevice[]): string[] {
  return [...new Set(devices.map((d) => deviceTypeGroupKey(d.detail)))].sort();
}

const DEVICE_DOMAIN_GROUP: Record<string, string> = {
  light: 'lights',
  switch: 'switches',
  input_boolean: 'switches',
  button: 'switches',
  input_button: 'switches',
  climate: 'climate',
  fan: 'climate',
  humidifier: 'climate',
  water_heater: 'climate',
  cover: 'covers',
  valve: 'covers',
  media_player: 'media',
  lock: 'security',
  alarm_control_panel: 'security',
  vacuum: 'cleaning',
  lawn_mower: 'cleaning',
};
