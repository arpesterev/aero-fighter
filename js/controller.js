import { validateEvent } from './events.js';

export class SceneController {
  constructor(world, log){
    this.world=world;this.log=log;
    this.phase='idle';this.age=0;this.launched=0;this.launchTimer=0;
    this.targetCount=0;this.severity=1;this.generation=0;
    this.note('Пост наблюдения активирован');
  }
  note(message,alert=false){
    const line=document.createElement('div');line.className='entry'+(alert?' alert':'');
    const time=document.createElement('time');time.textContent=new Date().toLocaleTimeString('ru-RU',{hour12:false});
    const label=document.createElement('span');label.textContent=message;
    line.append(time,label);this.log.prepend(line);
    while(this.log.children.length>5)this.log.lastElementChild.remove();
  }
  trigger(input){
    const e=validateEvent(input);
    this.generation++;this.age=0;this.launched=0;this.launchTimer=0;
    this.world.clear();
    if(e.type==='clear'){
      this.phase='idle';this.targetCount=0;this.note('Воздушное пространство чисто');return e;
    }
    this.phase='alert';this.targetCount=e.count;this.severity=e.severity;
    this.willEngage=e.type!=='alert';
    this.delay=e.type==='engage'?.65:2.3;
    for(let i=0;i<e.count;i++)this.world.makeThreat(i,e.count);
    this.note(`ВНИМАНИЕ: ${e.count} отметок на радаре`,true);
    return e;
  }
  update(dt){
    if(this.phase==='idle')return;
    this.age+=dt;
    if(this.phase==='alert'){
      if(this.age>=this.delay && this.willEngage){
        this.phase='engaging';this.age=0;this.launchTimer=.18;
        this.note('Автоматические системы начали перехват',true);
      }else if(!this.willEngage && this.age>10){this.trigger({type:'clear'});}
    }else if(this.phase==='engaging'){
      this.launchTimer-=dt;
      if(this.launchTimer<=0 && this.launched<this.targetCount){
        this.launchTimer=.8;
        const target=this.world.threats[this.launched];
        if(target&&!target.dead){this.world.launchAt(target,this.launched);this.note(`Пуск перехватчика ${String(this.launched+1).padStart(2,'0')}`);}
        this.launched++;
      }
      if(this.launched>=this.targetCount && this.world.threats.every(t=>t.dead) && this.world.interceptors.length===0){
        this.phase='cooldown';this.age=0;this.note('Цели перехвачены. Наблюдение продолжается');
      }
      if(this.age>24){this.phase='cooldown';this.age=0;this.note('Возврат к дежурству');}
    }else if(this.phase==='cooldown' && this.age>9){this.trigger({type:'clear'});}
  }
  getStatus(){
    const contacts=this.world.threats.filter(t=>!t.dead).length;
    switch(this.phase){
      case 'alert':return {title:'Цели обнаружены',description:'Радар фиксирует движение в воздушном пространстве. Системы обороны переходят в режим сопровождения.',state:'ОБНАРУЖЕНИЕ',top:'ТРЕВОГА / СОПРОВОЖДЕНИЕ',contacts};
      case 'engaging':return {title:'Работа ПВО',description:'Автоматический сценарий перехвата: пусковые установки задействованы, ракеты набирают высоту.',state:'ПЕРЕХВАТ',top:'ПЕРЕХВАТ ВЫПОЛНЯЕТСЯ',contacts};
      case 'cooldown':return {title:'Небо под контролем',description:'Перехват завершён. Рассеивание дымных следов и возвращение к непрерывному наблюдению.',state:'ВОССТАНОВЛЕНИЕ',top:'УГРОЗЫ НЕ ОБНАРУЖЕНЫ',contacts};
      default:return {title:'Мирное небо',description:'Радар ведёт обзор сектора. Системы охраны воздушного пространства находятся в режиме дежурства.',state:'ДЕЖУРСТВО',top:'ВОЗДУШНОЕ ПРОСТРАНСТВО ЧИСТО',contacts:0};
    }
  }
}
