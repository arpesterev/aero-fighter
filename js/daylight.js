// Local civil-time look, updated live from the viewer's computer clock.
export function daylightState(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const daylight = smooth(5.0, 8.0, h) * (1 - smooth(17.0, 20.5, h));
  const dusk = Math.max(1 - Math.abs(h - 19) / 2.3, 1 - Math.abs(h - 6.15) / 1.5, 0);
  const label = h >= 5 && h < 8 ? 'РАССВЕТ' : h >= 8 && h < 17.5 ? 'ДЕНЬ' : h >= 17.5 && h < 21 ? 'СУМЕРКИ' : 'НОЧЬ';
  return {hour:h, daylight:Math.max(0,Math.min(1,daylight)), dusk, label};
}
