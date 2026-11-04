import test from 'node:test';
import assert from 'node:assert/strict';
import {daylightState} from '../js/daylight.js';
test('day and night follow local computer clock',()=>{
  const daytime=daylightState(new Date(2026,5,20,12,0,0));
  const nighttime=daylightState(new Date(2026,5,20,1,0,0));
  assert.equal(daytime.label,'ДЕНЬ');assert.equal(nighttime.label,'НОЧЬ');
  assert.ok(daytime.daylight>.9);assert.ok(nighttime.daylight<.1);
});
test('twilight blends continuously',()=>{
  const evening=daylightState(new Date(2026,5,20,19,0,0));
  assert.equal(evening.label,'СУМЕРКИ');assert.ok(evening.dusk>.6);
  assert.ok(evening.daylight>=0&&evening.daylight<=1);
});
