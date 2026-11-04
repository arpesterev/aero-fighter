import * as THREE from 'three';
import { daylightState } from './daylight.js';

const UP=new THREE.Vector3(0,1,0);
const SKY_TOP_NIGHT=new THREE.Color('#030e23');
const SKY_HORIZON_NIGHT=new THREE.Color('#26344d');
const SKY_TOP_DAY=new THREE.Color('#226db7');
const SKY_HORIZON_DAY=new THREE.Color('#b6dfed');
const WARM=new THREE.Color('#ef9878');
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(a,min,max)=>Math.max(min,Math.min(max,a));

function cloudyTexture() {
  const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
  for(let i=0;i<22;i++){
    const x=rand(80,430),y=rand(105,150),rx=rand(45,90),ry=rand(25,53);
    g.save();g.translate(x,y);g.scale(rx,ry);
    const grad=g.createRadialGradient(0,0,.10,0,0,1);
    grad.addColorStop(0,'rgba(255,255,255,.22)');grad.addColorStop(.55,'rgba(255,255,255,.18)');grad.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grad;g.beginPath();g.arc(0,0,1,0,Math.PI*2);g.fill();g.restore();
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function smokeTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,.8)');gr.addColorStop(.25,'rgba(255,255,255,.65)');gr.addColorStop(.6,'rgba(255,255,255,.28)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,1,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.15,'rgba(255,240,190,.95)');gr.addColorStop(.48,'rgba(255,129,55,.3)');gr.addColorStop(1,'rgba(255,75,32,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
function metal(color='#50626c',roughness=.68){return new THREE.MeshStandardMaterial({color,metalness:.43,roughness});}
function box(parent,size,at,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...at);parent.add(mesh);return mesh;}
function cylinder(parent,r1,r2,h,at,material,segments=12){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);mesh.position.set(...at);parent.add(mesh);return mesh;}
function line(parent,points,color,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.LineBasicMaterial({color,transparent:opacity!==1,opacity});const l=new THREE.Line(g,m);parent.add(l);return l;}
function removeObject(o){o.parent?.remove(o);o.traverse?.(v=>{if(v.geometry)v.geometry.dispose();if(v.material){for(const m of Array.isArray(v.material)?v.material:[v.material])m.dispose();}});}

export class World {
  constructor(canvas){
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.2;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#8dc7e5');
    this.scene.fog=new THREE.FogExp2('#b4d8e1',.002);
    this.camera=new THREE.PerspectiveCamera(61,1,.1,2000);
    this.camera.position.set(0,29,73);
    this.camera.lookAt(0,18,-90);
    this.clock=0;this.lightTimer=0;this.phase='idle';
    this.threats=[];this.interceptors=[];this.smoke=[];this.bursts=[];
    this.cloudMap=cloudyTexture();this.smokeMap=smokeTexture();this.glowMap=glowTexture();
    this.steel=metal('#5b6973');this.steelDark=metal('#263b44');this.steelLight=metal('#80919a');this.orange=new THREE.MeshBasicMaterial({color:'#ffbd70'});
    this._buildSky();this._buildLand();this._buildBase();this._buildTower();this._buildLaunchers();this._buildAccents();
    this.resize();this.updateLighting();
    window.addEventListener('resize',()=>this.resize());
  }
  resize(){const w=window.innerWidth,h=window.innerHeight;this.camera.aspect=w/Math.max(1,h);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  _buildSky(){
    const shader=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{topColor:{value:SKY_TOP_DAY.clone()},bottomColor:{value:SKY_HORIZON_DAY.clone()}},
      vertexShader:`varying float elevation;void main(){elevation=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform vec3 topColor;uniform vec3 bottomColor;varying float elevation;void main(){float t=clamp((elevation/900.0+.045)*2.6,0.0,1.0);t=pow(t,.85);gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0);}`});
    this.skyMat=shader;this.sky=new THREE.Mesh(new THREE.SphereGeometry(900,32,20),shader);
    this.sky.frustumCulled=false;this.scene.add(this.sky);
    const coords=[];for(let i=0;i<560;i++){
      const theta=rand(0,Math.PI*2),u=rand(.03,1),y=Math.sqrt(u)*430;
      const r=Math.sqrt(1-(y/480)**2)*480;
      coords.push(Math.cos(theta)*r,y,Math.sin(theta)*r);
    }
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    this.starMat=new THREE.PointsMaterial({color:'#e3f1ff',size:2.2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
    this.stars=new THREE.Points(sg,this.starMat);this.stars.frustumCulled=false;this.scene.add(this.stars);
    this.sun=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,color:'#ffebad',transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    this.sun.position.set(-220,215,-420);this.sun.scale.set(80,80,1);this.scene.add(this.sun);
    this.clouds=[];
    for(let i=0;i<33;i++){
      const material=new THREE.SpriteMaterial({map:this.cloudMap,color:'#f9ffff',transparent:true,opacity:.57,depthWrite:false,fog:false});
      const s=new THREE.Sprite(material);
      s.position.set(rand(-310,310),rand(47,149),rand(-415,-155));
      const scale=rand(55,125);s.scale.set(scale,scale*.47,1);
      this.scene.add(s);this.clouds.push({sprite:s,origin:s.position.x,speed:rand(.04,.15)});
    }
    this.hemisphere=new THREE.HemisphereLight('#d0efff','#324048',2.0);this.scene.add(this.hemisphere);
    this.sunLight=new THREE.DirectionalLight('#ffecce',2.1);this.sunLight.position.set(-95,160,-180);this.scene.add(this.sunLight);
  }
  _buildLand(){
    const geometry=new THREE.PlaneGeometry(850,800,68,64);geometry.rotateX(-Math.PI/2);
    const pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      const base=Math.sin(x*.016)*2.4+Math.cos(z*.011)*2.2+Math.cos(x*.033+z*.019)*1.1;
      const flatten=clamp((Math.max(Math.abs(x)-130,Math.abs(z+60)-115))/40,0,1);
      pos.setY(i,base*flatten-.25);
    }
    geometry.computeVertexNormals();
    const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#607568',roughness:1}));this.scene.add(ground);
    for(let layer=0;layer<3;layer++){
      const z=-360-layer*130,cols=70,pts=[];
      for(let i=0;i<=cols;i++){
        const x=(i/cols-.5)*1400;
        const h=layer*6+13+Math.abs(Math.sin(i*.31+layer))*21+Math.sin(i*.82+layer*2)*5;
        pts.push(x,h,z,x,-16,z);
      }
      const vertices=[];
      for(let i=0;i<cols;i++){
        const j=i*6,k=(i+1)*6;
        vertices.push(pts[j],pts[j+1],pts[j+2],pts[k],pts[k+1],pts[k+2],pts[j+3],pts[j+4],pts[j+5],pts[k],pts[k+1],pts[k+2]);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
      this.scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:layer===0?'#7e9a94':layer===1?'#a1b6af':'#b3c5bf',side:THREE.DoubleSide,fog:true})));
    }
    const treeMat=new THREE.MeshStandardMaterial({color:'#405d52',roughness:1});
    const trunkMat=new THREE.MeshStandardMaterial({color:'#485858'});
    for(let i=0;i<75;i++){
      const x=rand(-250,250),z=rand(-230,-50);
      if(Math.abs(x)<108&&z>-165)continue;
      const h=rand(5,11);cylinder(this.scene,.3,.45,h*.45,[x,h*.2,z],trunkMat,6);
      const crown=new THREE.Mesh(new THREE.ConeGeometry(h*.35,h,6),treeMat);crown.position.set(x,h*.72,z);this.scene.add(crown);
    }
  }
  _buildBase(){
    const concrete=new THREE.MeshStandardMaterial({color:'#4b6267',roughness:.93});
    const paving=new THREE.Mesh(new THREE.PlaneGeometry(210,154),concrete);paving.rotation.x=-Math.PI/2;paving.position.set(0,.13,-81);this.scene.add(paving);
    const stripe=new THREE.MeshBasicMaterial({color:'#a3ad9c'});
    for(const x of [-82,-28,28,82]){box(this.scene,[.26,.035,150],[x,.19,-81],stripe);}
    for(const z of [-145,-81,-18]){box(this.scene,[193,.035,.23],[0,.2,z],stripe);}
    const wall=metal('#536569');
    for(const z of [-159,-6]){box(this.scene,[210,3,1],[0,1.5,z],wall);}
    for(const x of [-105,105]){box(this.scene,[1,3,153],[x,1.5,-82],wall);}
    const hangarMat=metal('#536c72');
    for(const [x,z,w] of [[-70,-132,36],[76,-131,31]]){
      box(this.scene,[w,13,24],[x,6.5,z],hangarMat);
      const roof=box(this.scene,[w+2,2,26],[x,14,z],this.steelDark);roof.rotation.z=.055;
      box(this.scene,[w-4,7,.25],[x,5,z+12.12],new THREE.MeshBasicMaterial({color:'#18343a'}));
      for(let j=-1;j<=1;j++)box(this.scene,[3,.3,.3],[x+j*8,10,z+12.4],new THREE.MeshBasicMaterial({color:'#a1f2d8'}));
    }
    const pole=metal('#607782');
    const lamp=new THREE.MeshBasicMaterial({color:'#ffe3ab'});
    for(const x of [-111,111])for(const z of [-157,-45]){
      cylinder(this.scene,.24,.28,18,[x,9,z],pole);
      box(this.scene,[3,.3,1],[x,18,z-1],lamp);
    }
  }
  _buildTower(){
    const construction=metal('#435b67');
    box(this.scene,[35,1.6,35],[0,25,67],construction);
    for(const x of [-15,15])for(const z of [52,82]){
      cylinder(this.scene,.95,1.1,26,[x,12.5,z],construction,8);
      line(this.scene,[[x,1,z],[x===15?-15:15,23,z===52?82:52]],'#6b8087',.65);
    }
    const rail=metal('#a5b7bd');
    for(const x of [-16,-8,0,8,16]){
      cylinder(this.scene,.18,.18,3,[x,28,49],rail,6);
      cylinder(this.scene,.18,.18,3,[x,28,84],rail,6);
    }
    box(this.scene,[35,.2,.2],[0,29.5,49],rail);
    box(this.scene,[35,.18,.18],[0,27.35,49],rail);
    box(this.scene,[35,.18,.18],[0,29.5,84],rail);
    const pod=box(this.scene,[9,2.3,5],[-16,27.5,51],this.steelDark);pod.rotation.y=.18;
    const screen=box(this.scene,[7,.12,3.8],[-16,28.8,51],new THREE.MeshBasicMaterial({color:'#183e4a'}));screen.rotation.x=-.08;
    cylinder(this.scene,1.1,1.3,13,[-25,21,34],construction);
    this.radarAntenna=new THREE.Group();this.radarAntenna.position.set(-25,28,34);this.scene.add(this.radarAntenna);
    cylinder(this.radarAntenna,2.1,1.5,1.6,[0,0,0],construction);
    const grill=box(this.radarAntenna,[13,3.5,.46],[0,2,0],this.steelLight);grill.rotation.z=.12;
    for(let i=-5;i<=5;i++)box(this.radarAntenna,[.11,3.8,.55],[i*1.1,2,0],this.steelDark);
    box(this.radarAntenna,[14,.2,.6],[0,3.7,0],rail);
  }
  _buildLaunchers(){
    this.pads=[];this.turretPivots=[];
    const launchPositions=[[-50,-61],[9,-76],[59,-61]];
    const green=metal('#667577');
    launchPositions.forEach(([x,z],index)=>{
      const g=new THREE.Group();g.position.set(x,0,z);this.scene.add(g);
      box(g,[13,1.9,15],[0,.9,0],this.steelDark);
      for(const dx of [-4,4])for(const dz of [-5,5])cylinder(g,.75,.8,1,[dx,1.4,dz],this.steel,9);
      for(let i=0;i<4;i++){
        const xx=(i%2?2.1:-2.1),zz=(i<2?-1.5:2.0);
        const tube=cylinder(g,1.1,1.15,10,[xx,6.1,zz],green);
        tube.rotation.x=-.14;
        const cap=cylinder(g,1.12,1.12,.6,[xx,11.3,zz-0.8],this.steelLight);
        cap.rotation.x=-.14;
      }
      this.pads.push(new THREE.Vector3(x,11.7,z));
      const l=new THREE.PointLight('#e5dba2',.4,28);l.position.set(x,9,z);this.scene.add(l);
    });
    const turret=new THREE.Group();turret.position.set(34,2,-31);this.scene.add(turret);
    cylinder(turret,7.8,7.1,3,[0,0,0],this.steelDark,16);
    cylinder(turret,4.2,4.2,4,[0,2.5,0],this.steel,20);
    const pivot=new THREE.Group();pivot.position.set(0,5.0,0);turret.add(pivot);
    const housing=new THREE.Mesh(new THREE.SphereGeometry(3.4,16,10),this.steelLight);housing.scale.set(1.5,.9,1.2);pivot.add(housing);
    for(let i=-2;i<=2;i++){
      const barrel=cylinder(pivot,.24,.24,9,[i*.72,.22,-6.8],metal('#34484f'),8);
      barrel.rotation.x=Math.PI/2;
    }
    this.turretPivots.push(pivot);
    this.turret=turret;
  }
  _buildAccents(){
    const mat=metal('#7c8f91');
    cylinder(this.scene,.65,.85,26,[94,13,-104],mat,8);
    box(this.scene,[7,1,1],[94,25,-104],mat);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,8),new THREE.MeshBasicMaterial({color:'#ffb67a'}));bulb.position.set(94,26,-104);this.scene.add(bulb);this.beacon=bulb;
    this.airfieldLights=[];
    for(const x of [-91,91])for(let i=0;i<7;i++){
      const b=new THREE.Mesh(new THREE.SphereGeometry(.55,6,6),new THREE.MeshBasicMaterial({color:i%2?'#b5e2f2':'#dfdca0'}));
      b.position.set(x,.7,-20-i*19);this.scene.add(b);this.airfieldLights.push(b);
    }
  }
  updateLighting(){
    const {daylight,dusk,label}=daylightState();this.timeLabel=label;
    const top=SKY_TOP_NIGHT.clone().lerp(SKY_TOP_DAY,daylight);
    const horizon=SKY_HORIZON_NIGHT.clone().lerp(SKY_HORIZON_DAY,daylight);
    horizon.lerp(WARM,dusk*.42);
    this.skyMat.uniforms.topColor.value.copy(top);this.skyMat.uniforms.bottomColor.value.copy(horizon);
    this.scene.fog.color.copy(horizon);this.scene.fog.density=.0024+(.0024*(1-daylight));
    this.starMat.opacity=clamp(1-daylight*1.65,0,.84);
    this.sun.material.opacity=daylight*.72;this.sunLight.intensity=.22+daylight*2.0;
    this.hemisphere.intensity=.38+daylight*1.8;
    this.renderer.toneMappingExposure=.85+daylight*.35;
    for(const {sprite} of this.clouds)sprite.material.opacity=.16+daylight*.45;
    this.beacon.material.color.set(daylight>.5?'#d5b095':'#ffd6a5');
  }
  makeThreat(index,count){
    const spread=count<=1?0:(index-(count-1)/2);
    const pos=new THREE.Vector3(spread*25+rand(-8,8),rand(85,116),-245-rand(0,50));
    const group=new THREE.Group();group.position.copy(pos);this.scene.add(group);
    const core=new THREE.Mesh(new THREE.ConeGeometry(1.3,9,9),new THREE.MeshStandardMaterial({color:'#b4b4ab',emissive:'#56372b',emissiveIntensity:.18}));
    core.rotation.x=Math.PI/2;group.add(core);
    const tail=new THREE.Mesh(new THREE.SphereGeometry(.65,8,8),new THREE.MeshBasicMaterial({color:'#ffad69'}));tail.position.z=-4.2;group.add(tail);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,color:'#ffa05d',transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(9,9,1);glow.position.z=-4;group.add(glow);
    const t={id:index,group,position:group.position,age:0,dead:false,velocity:new THREE.Vector3(-spread*.24,-1.0,7.5+index*.35),glow};
    this.threats.push(t);return t;
  }
  launchAt(threat,index=0){
    if(threat.dead)return null;
    const start=this.pads[index%this.pads.length].clone();
    const end=threat.position.clone().add(threat.velocity.clone().multiplyScalar(3.3));
    const control=start.clone().lerp(end,.38);control.y=Math.max(start.y+72,end.y+12);
    const path=new THREE.QuadraticBezierCurve3(start,control,end);
    const model=new THREE.Group();model.position.copy(start);this.scene.add(model);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.55,.75,8,10),new THREE.MeshStandardMaterial({color:'#f3f3ef',emissive:'#b9baa9',emissiveIntensity:.27}));model.add(body);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.56,2,10),new THREE.MeshStandardMaterial({color:'#f5f4eb'}));nose.position.y=5;model.add(nose);
    const exhaust=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,color:'#ffce81',transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}));exhaust.position.y=-5;exhaust.scale.set(9,15,1);model.add(exhaust);
    const points=new Float32Array(420*3);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(points,3));geometry.setDrawRange(0,0);
    const trail=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#fff2dc',transparent:true,opacity:.85,depthWrite:false}));this.scene.add(trail);
    const m={model,path,trail,trailBuffer:points,traceCount:0,age:0,duration:rand(2.9,3.5),target:threat,lastSmoke:0,lastPoint:start.clone(),done:false};
    this.interceptors.push(m);
    return m;
  }
  puff(position,size=6,color='#f7f6e9'){
    if(this.smoke.length>380){const p=this.smoke.shift();removeObject(p.sprite);}
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.smokeMap,color,transparent:true,opacity:.34,depthWrite:false,fog:true}));
    sprite.position.copy(position);sprite.scale.set(size,size,1);this.scene.add(sprite);
    this.smoke.push({sprite,age:0,life:rand(2.8,4.7),velocity:new THREE.Vector3(rand(-1,1),rand(.25,.9),rand(-.7,.7)),size});
  }
  burst(position){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowMap,color:'#ffdcb0',transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));
    sprite.position.copy(position);sprite.scale.set(2,2,1);this.scene.add(sprite);
    const ring=new THREE.Mesh(new THREE.RingGeometry(1,1.15,36),new THREE.MeshBasicMaterial({color:'#ffd0a8',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    ring.position.copy(position);ring.lookAt(this.camera.position);this.scene.add(ring);
    const light=new THREE.PointLight('#ffb56d',20,140);light.position.copy(position);this.scene.add(light);
    this.bursts.push({sprite,ring,light,age:0,life:1.5});
    for(let i=0;i<19;i++)this.puff(position.clone().add(new THREE.Vector3(rand(-6,6),rand(-6,6),rand(-6,6))),rand(3,8),i%4===0?'#ffe0b4':'#9ba3a3');
  }
  clear(){
    for(const t of this.threats)removeObject(t.group);
    for(const m of this.interceptors){removeObject(m.model);removeObject(m.trail);}
    this.threats=[];this.interceptors=[];
    for(const b of this.bursts){removeObject(b.sprite);removeObject(b.ring);this.scene.remove(b.light);}
    this.bursts=[];
  }
  update(dt,phase){
    this.clock+=dt;this.phase=phase;this.lightTimer+=dt;
    if(this.lightTimer>5){this.lightTimer=0;this.updateLighting();}
    this.radarAntenna.rotation.y=this.clock*.5;
    this.beacon.material.color.setHSL(.075,.9,(Math.sin(this.clock*3.2)+1)*.15+.25);
    for(const c of this.clouds)c.sprite.position.x=c.origin+Math.sin(this.clock*c.speed)*6;
    this.camera.position.x=Math.sin(this.clock*.15)*.26;
    this.camera.position.y=29+Math.sin(this.clock*.17)*.07;
    this.camera.lookAt(0,18,-90);
    this.sky.position.copy(this.camera.position);this.stars.position.copy(this.camera.position);
    for(const t of this.threats){
      if(t.dead)continue;
      t.age+=dt;t.position.addScaledVector(t.velocity,dt);
      t.group.rotation.z=Math.sin(t.age*.8+t.id)*.045;
      t.glow.material.opacity=.55+.25*Math.sin(t.age*8);
      if(t.age>27){t.dead=true;removeObject(t.group);}
    }
    for(const missile of [...this.interceptors]){
      missile.age+=dt;
      const t=clamp(missile.age/missile.duration,0,1);
      const p=missile.path.getPoint(t);
      missile.model.position.copy(p);
      const tangent=missile.path.getTangent(t).normalize();
      missile.model.quaternion.setFromUnitVectors(UP,tangent);
      missile.traceCount=Math.min(420,missile.traceCount+1);
      const a=missile.trailBuffer;
      const i=(missile.traceCount-1)*3;a[i]=p.x;a[i+1]=p.y;a[i+2]=p.z;
      missile.trail.geometry.attributes.position.needsUpdate=true;missile.trail.geometry.setDrawRange(0,missile.traceCount);
      missile.lastSmoke+=dt;
      if(missile.lastSmoke>.04){missile.lastSmoke=0;this.puff(p.clone().addScaledVector(tangent,-5),rand(4.2,8.5));}
      if(t>=1){
        missile.done=true;
        if(!missile.target.dead){missile.target.dead=true;const impact=missile.target.position.clone();removeObject(missile.target.group);this.burst(impact);}
        removeObject(missile.model);removeObject(missile.trail);
      }
    }
    this.interceptors=this.interceptors.filter(m=>!m.done);
    for(const p of [...this.smoke]){
      p.age+=dt;p.sprite.position.addScaledVector(p.velocity,dt);
      const f=1-p.age/p.life;
      p.sprite.material.opacity=clamp(f*.42,0,.42);
      const size=p.size*(1+p.age*.37);p.sprite.scale.set(size,size,1);
      if(p.age>=p.life){removeObject(p.sprite);}
    }
    this.smoke=this.smoke.filter(p=>p.age<p.life);
    for(const b of [...this.bursts]){
      b.age+=dt;const t=b.age/b.life;
      b.sprite.scale.setScalar(13+75*Math.sin(Math.min(1,t)*Math.PI*.7));b.sprite.material.opacity=clamp(1-t,0,1);
      const s=3+t*58;b.ring.scale.set(s,s,1);b.ring.material.opacity=clamp((1-t)*.8,0,.8);
      b.light.intensity=20*(1-t)**2;
      if(t>=1){removeObject(b.sprite);removeObject(b.ring);this.scene.remove(b.light);}
    }
    this.bursts=this.bursts.filter(b=>b.age<b.life);
    const focus=this.threats.find(t=>!t.dead);
    if(focus){
      const aim=focus.position.clone().sub(new THREE.Vector3(34,7,-31)).normalize();
      const yaw=Math.atan2(-aim.x,-aim.z);
      this.turret.rotation.y+=clamp(yaw-this.turret.rotation.y,-dt*.7,dt*.7);
      const elev=clamp(Math.asin(aim.y),.10,1.15);
      this.turretPivots[0].rotation.x+=clamp(-elev-this.turretPivots[0].rotation.x,-dt*.7,dt*.7);
    }else{
      this.turretPivots[0].rotation.x+=(-.18-this.turretPivots[0].rotation.x)*Math.min(1,dt*.4);
    }
    this.renderer.render(this.scene,this.camera);
  }
}
