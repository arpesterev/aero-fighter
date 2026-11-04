const TAU = Math.PI * 2;
export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.angle = 0;
  }
  draw(delta, threats, now = performance.now()) {
    const ctx = this.ctx;
    const d = this.canvas.width;
    const m = d / 2;
    const radius = d * .45;
    this.angle = (this.angle + delta * .67) % TAU;
    ctx.clearRect(0, 0, d, d);
    ctx.fillStyle = 'rgba(1,25,23,.95)';
    ctx.beginPath();ctx.arc(m,m,radius,0,TAU);ctx.fill();
    ctx.save();ctx.translate(m,m);
    ctx.strokeStyle='rgba(101,245,175,.27)';ctx.lineWidth=1;
    for (let i=1;i<=4;i++){ctx.beginPath();ctx.arc(0,0,radius*i/4,0,TAU);ctx.stroke();}
    for (let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);ctx.stroke();}
    for(let i=44;i>=0;i--){const a=this.angle-i*.021;ctx.strokeStyle=`rgba(55,255,139,${.004+(.07*(1-i/44))})`;ctx.lineWidth=radius;ctx.beginPath();ctx.arc(0,0,radius/2,a,a+.015);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(this.angle)*radius,Math.sin(this.angle)*radius);ctx.strokeStyle='rgba(152,255,195,.75)';ctx.lineWidth=2;ctx.stroke();
    for(let i=0;i<threats.length;i++){
      const t=threats[i]; if(t.dead)continue;
      const x=Math.max(-.94,Math.min(.94,t.position.x/135))*radius;
      const y=Math.max(-.94,Math.min(.94,(t.position.z+35)/215))*radius;
      if(x*x+y*y > radius*radius)continue;
      const pulse=.65+.35*Math.sin(now*.005+i*1.2);
      ctx.fillStyle=`rgba(255,130,103,${pulse})`;
      ctx.shadowColor='#ff9569';ctx.shadowBlur=12;
      ctx.beginPath();ctx.arc(x,y,4,0,TAU);ctx.fill();ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,178,141,.8)';ctx.lineWidth=1.2;ctx.strokeRect(x-7,y-7,14,14);
      ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#f6b998';ctx.fillText(`T${String(i+1).padStart(2,'0')}`,x+11,y-11);
    }
    ctx.fillStyle='#8df7bb';ctx.shadowBlur=4;ctx.shadowColor='#a7f5bc';ctx.beginPath();ctx.arc(0,0,3.5,0,TAU);ctx.fill();ctx.restore();
  }
}
