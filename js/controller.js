import { validateEvent } from './events.js';

// Only an EXTERNAL "clear" event can return the system to idle.
// Clearing a batch of visual targets is NOT equivalent to clearing the alert.
export class SceneController {
  constructor(world, log) {
    this.world = world;
    this.log = log;
    this.phase = 'idle';
    this.age = 0;
    this.cycleAge = 0;
    this.cycleWait = 0;
    this.launched = 0;
    this.launchTimer = 0;
    this.targetCount = 0;
    this.severity = 1;
    this.generation = 0;
    this.willEngage = false;
    this.delay = 0;
    this.note('Пост наблюдения активирован');
  }

  note(message, alert = false) {
    const line = document.createElement('div');
    line.className = 'entry' + (alert ? ' alert' : '');
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const label = document.createElement('span');
    label.textContent = message;
    line.append(time, label);
    this.log.prepend(line);
    while (this.log.children.length > 5) this.log.lastElementChild.remove();
  }

  resetVisualContacts() {
    // Once a batch is complete, start a new fictional salvo without ending combat.
    this.world.clear();
    this.launched = 0;
    this.launchTimer = 0.18;
    this.cycleAge = 0;
    this.cycleWait = 0;
    for (let i = 0; i < this.targetCount; i++) this.world.makeThreat(i, this.targetCount);
  }

  trigger(input) {
    const e = validateEvent(input);
    this.generation++;
    this.age = 0;

    if (e.type === 'clear') {
      this.world.clear();
      this.phase = 'idle';
      this.targetCount = 0;
      this.launched = 0;
      this.cycleAge = 0;
      this.cycleWait = 0;
      this.willEngage = false;
      this.note('Получено CLEAR. Воздушное пространство чисто');
      return e;
    }

    this.targetCount = e.count;
    this.severity = e.severity;
    this.phase = 'alert';
    // "alert" is a persistent radar-only state, "incoming"/"engage" engage
    // continuously until a separate, explicit "clear" event arrives.
    this.willEngage = e.type !== 'alert';
    this.delay = e.type === 'engage' ? 0.65 : 2.3;
    this.resetVisualContacts();
    this.note(`ВНИМАНИЕ: ${e.count} отметок на радаре`, true);
    return e;
  }

  update(dt) {
    if (this.phase === 'idle') return;
    this.age += dt;

    if (this.phase === 'alert') {
      if (this.willEngage && this.age >= this.delay) {
        this.phase = 'engaging';
        this.age = 0;
        this.launchTimer = 0.18;
        this.note('ПВО начала непрерывное дежурное отражение угроз', true);
      } else if (!this.willEngage) {
        // Stay on alert indefinitely; refresh radar-only contacts as required.
        if (this.world.threats.every(t => t.dead)) {
          this.cycleWait += dt;
          if (this.cycleWait >= 2) this.resetVisualContacts();
        }
      }
      return;
    }

    if (this.phase !== 'engaging') return;
    this.cycleAge += dt;
    this.launchTimer -= dt;
    if (this.launchTimer <= 0 && this.launched < this.targetCount) {
      this.launchTimer = 0.8;
      const target = this.world.threats[this.launched];
      if (target && !target.dead) {
        this.world.launchAt(target, this.launched);
        this.note(`Пуск перехватчика ${String(this.launched + 1).padStart(2, '0')}`);
      }
      this.launched++;
    }

    const batchResolved = this.launched >= this.targetCount &&
      this.world.threats.every(t => t.dead) &&
      this.world.interceptors.length === 0;
    const overdue = this.cycleAge >= 32;
    if (batchResolved || overdue) {
      this.cycleWait += dt;
      if (this.cycleWait >= (batchResolved ? 3 : 0.5)) {
        this.resetVisualContacts();
        this.note('Новые отметки. ПВО продолжает работу', true);
      }
    } else {
      this.cycleWait = 0;
    }
  }

  getStatus() {
    const contacts = this.world.threats.filter(t => !t.dead).length;
    if (this.phase === 'alert') return {
      title: 'Цели обнаружены',
      description: 'Радар отслеживает угрозы. Тревога останется активной до внешнего события CLEAR.',
      state: 'ОБНАРУЖЕНИЕ',
      top: 'ТРЕВОГА / СОПРОВОЖДЕНИЕ',
      contacts
    };
    if (this.phase === 'engaging') return {
      title: 'Работа ПВО',
      description: 'Система непрерывно отражает условные угрозы. Огонь прекратится только после внешнего события CLEAR.',
      state: 'ПЕРЕХВАТ',
      top: 'ПВО В РАБОТЕ / ОЖИДАЕТ CLEAR',
      contacts
    };
    return {
      title: 'Мирное небо',
      description: 'Радар ведёт обзор сектора. Системы охраны воздушного пространства находятся в режиме дежурства.',
      state: 'ДЕЖУРСТВО',
      top: 'ВОЗДУШНОЕ ПРОСТРАНСТВО ЧИСТО',
      contacts: 0
    };
  }
}
