export const EVENT_TYPES = new Set(['incoming', 'alert', 'engage', 'clear']);
export function validateEvent(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Expected an event object');
  const type = data.type;
  if (!EVENT_TYPES.has(type)) throw new TypeError('Unknown type. Use incoming, alert, engage, or clear');
  const count = data.count === undefined ? 3 : data.count;
  if (!Number.isSafeInteger(count) || count < 1 || count > 6) throw new TypeError('count must be an integer from 1 to 6');
  const severity = data.severity === undefined ? 2 : data.severity;
  if (!Number.isSafeInteger(severity) || severity < 1 || severity > 3) throw new TypeError('severity must be an integer from 1 to 3');
  if (data.siren !== undefined && typeof data.siren !== 'boolean') throw new TypeError('siren must be boolean');
  // Ignore arbitrary extra properties. No code, paths, or commands are accepted.
  return {type, count, severity, siren: data.siren === true};
}
