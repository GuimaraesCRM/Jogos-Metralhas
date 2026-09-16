import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

const manager=new THREE.LoadingManager();
manager.setURLModifier(url=>/Textures\/colormap\.png$/i.test(url)?new URL('./models/Textures/colormap.png',document.baseURI).href:url);
const loader = new GLTFLoader(manager);
const cache = new Map();
const load = url => {
  if (!cache.has(url)) cache.set(url, new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject)));
  return cache.get(url);
};
function proceduralDie(){
  const group=new THREE.Group(),core=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.7,1.7),new THREE.MeshStandardMaterial({color:0xf7f3e8,roughness:.38}));core.name='Dado 3D procedural';group.add(core);
  const faces=[[1,[0,.856,0],[-Math.PI/2,0,0]],[6,[0,-.856,0],[Math.PI/2,0,0]],[2,[0,0,.856],[0,0,0]],[5,[0,0,-.856],[0,Math.PI,0]],[3,[.856,0,0],[0,Math.PI/2,0]],[4,[-.856,0,0],[0,-Math.PI/2,0]]];
  const spots={1:[[0,0]],2:[[-.42,.42],[.42,-.42]],3:[[-.42,.42],[0,0],[.42,-.42]],4:[[-.42,.42],[.42,.42],[-.42,-.42],[.42,-.42]],5:[[-.42,.42],[.42,.42],[0,0],[-.42,-.42],[.42,-.42]],6:[[-.42,.48],[-.42,0],[-.42,-.48],[.42,.48],[.42,0],[.42,-.48]]};
  for(const [value,position,rotation] of faces){const face=new THREE.Group(),plate=new THREE.Mesh(new THREE.PlaneGeometry(1.58,1.58),new THREE.MeshBasicMaterial({color:0xf7f3e8}));face.add(plate);for(const [x,y] of spots[value]){const pip=new THREE.Mesh(new THREE.CircleGeometry(.14,20),new THREE.MeshBasicMaterial({color:0x172b3c}));pip.position.set(x,y,.012);face.add(pip);}face.position.set(...position);face.rotation.set(...rotation);group.add(face);}return group;
}

class Model3D extends HTMLElement {
  static observedAttributes=['src'];
  connectedCallback(){ this.load(); }
  attributeChangedCallback(){ if(this.isConnected) this.load(); }
  async load(){
    const src=this.getAttribute('src'); if(!src||this.loaded===src)return; this.loaded=src;
    this.replaceChildren(); const canvas=document.createElement('canvas'); this.append(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(28,1,.01,100);
    scene.add(new THREE.HemisphereLight(0xffffff,0x304050,2.5)); const key=new THREE.DirectionalLight(0xffffff,4); key.position.set(3,5,4); scene.add(key);
    try{
      const model=src==='procedural:dice'?proceduralDie():(await load(src)).scene.clone(true); scene.add(model);
      const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()); model.position.sub(center);
      const largest=Math.max(size.x,size.y,size.z)||1; camera.position.set(largest*1.7,largest*1.25,largest*2.6); camera.lookAt(0,0,0); camera.near=largest/100; camera.far=largest*20; camera.updateProjectionMatrix();
      const file=decodeURIComponent(src).toLowerCase(),characterIndex=['female-a','female-b','female-c','female-d','female-e','female-f','male-a','male-b','male-c','male-d','male-e','male-f'].findIndex(name=>file.includes(`character-${name}`));
      const tint=characterIndex>=0?[0xe78aa6,0x72bce5,0xe6bc58,0x9b85db,0x52c5ac,0xed8d62,0x477ee5,0x37a082,0xd56848,0x7656bb,0xc99c38,0x516878][characterIndex]:file.includes('hotel')?0xc94f59:file.includes('casa')?0x4caf68:null;
      model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;if(tint!==null){node.material=Array.isArray(node.material)?node.material.map(material=>material.clone()):node.material.clone();for(const material of Array.isArray(node.material)?node.material:[node.material])material.color?.setHex(tint);}}}); this.model=model; this.basePosition=model.position.clone(); this.renderer=renderer; this.scene=scene; this.camera=camera;
      this.resize=()=>{const w=Math.max(1,this.clientWidth),h=Math.max(1,this.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
      this.observer=new ResizeObserver(this.resize);this.observer.observe(this);this.resize(); this.dispatchEvent(new CustomEvent('model-ready')); if(this.pendingThrow){const value=this.pendingThrow;this.pendingThrow=null;this.animateThrow(value);}
    }catch(error){this.dataset.error='true';console.error('Falha ao carregar modelo 3D',src,error);}
  }
  disconnectedCallback(){this.observer?.disconnect();this.renderer?.dispose();}
  animateThrow(seed=1){
    if(!this.model){this.pendingThrow=seed;return;} const start=performance.now(),duration=1150,base=this.model.rotation.clone(),origin=this.basePosition.clone();
    const land=[[0,0,0],[0,0,-Math.PI/2],[Math.PI/2,0,0],[-Math.PI/2,0,0],[0,0,Math.PI/2],[Math.PI,0,0]][Math.max(1,Math.min(6,seed))-1];
    const frame=now=>{const t=Math.min(1,(now-start)/duration),arc=Math.sin(Math.PI*t);this.model.rotation.set(base.x+(10+seed)*Math.PI*2*t,base.y+(8+seed)*Math.PI*2*t,base.z+6*Math.PI*t);this.model.position.copy(origin).add(new THREE.Vector3(Math.sin(t*Math.PI*2)*2.5*(1-t),-1.2*arc+Math.sin(t*Math.PI*4)*.25,arc*2));this.renderer.render(this.scene,this.camera);if(t<1)requestAnimationFrame(frame);else{this.model.position.copy(origin);this.model.rotation.set(...land);this.renderer.render(this.scene,this.camera);}};requestAnimationFrame(frame);
  }
}
customElements.define('model-3d',Model3D);
