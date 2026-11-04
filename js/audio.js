export class Siren {
  constructor(){this.enabled=false;this.ctx=null;this.lastPlayed=-Infinity;this.active=[];}
  async setEnabled(on){
    this.enabled=!!on;
    if(!this.enabled){this.stop();return false;}
    try{
      this.ctx ??= new (window.AudioContext||window.webkitAudioContext)();
      await this.ctx.resume();
      return this.ctx.state==='running';
    }catch{this.enabled=false;return false;}
  }
  play(){
    if(!this.enabled || !this.ctx || this.ctx.state!=='running')return false;
    const now=this.ctx.currentTime;
    if(now-this.lastPlayed<45)return false;
    this.lastPlayed=now;
    const gain=this.ctx.createGain();gain.gain.value=0;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(.035,now+.12);
    gain.gain.setValueAtTime(.035,now+2.6);
    gain.gain.linearRampToValueAtTime(0,now+3.0);
    gain.connect(this.ctx.destination);
    const osc=this.ctx.createOscillator();osc.type='sine';
    osc.frequency.setValueAtTime(420,now);
    osc.frequency.linearRampToValueAtTime(600,now+.65);
    osc.frequency.linearRampToValueAtTime(420,now+1.3);
    osc.frequency.linearRampToValueAtTime(600,now+1.95);
    osc.frequency.linearRampToValueAtTime(420,now+2.7);
    osc.connect(gain);osc.start(now);osc.stop(now+3.01);
    this.active.push({osc,gain});osc.onended=()=>{gain.disconnect();this.active=this.active.filter(v=>v.osc!==osc);};
    return true;
  }
  stop(){for(const {osc,gain} of this.active){try{osc.stop();gain.disconnect();}catch{}}this.active=[];}
}
