import * as THREE from './assets/vendor/three.module.js';

// Local axes: +Z nose, +Y cabin roof, +X right wing. Geometry is shared by the fleet.
export function aircraftGeometries() {
  const parts={white:[],livery:[],glass:[],accent:[]};
  function add(key,geometry,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]) {
    const transform=new THREE.Object3D();
    transform.position.set(...position);transform.rotation.set(...rotation);transform.scale.set(...scale);transform.updateMatrix();
    const mesh=geometry.index?geometry.toNonIndexed():geometry.clone();mesh.applyMatrix4(transform.matrix);
    parts[key].push(mesh);geometry.dispose();
  }
  function panel(points,depth=.0012) {
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    return new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.0003,bevelThickness:.00025,curveSegments:2});
  }
  const body=[[0,-.057],[.0012,-.052],[.0036,-.041],[.0056,-.026],[.0062,-.010],[.0062,.029],[.0055,.039],[.0038,.048],[.0018,.053],[0,.055]];
  add('white',new THREE.LatheGeometry(body.map(p=>new THREE.Vector2(...p)),20),[0,0,0],[Math.PI/2,0,0]);
  for(const side of [-1,1]) {
    // Swept wings have a distinct leading edge, tapered tip, and swept trailing edge.
    add('white',panel([[side*.004,.018],[side*.043,-.012],[side*.046,-.019],[side*.034,-.017],[side*.005,-.006]]),[0,-.001,0],[Math.PI/2,0,0]);
    add('white',panel([[side*.003,-.031],[side*.019,-.045],[side*.020,-.050],[side*.003,-.044]]),[0,.003,0],[Math.PI/2,0,0]);
    // Keep both tips continuous with the wing: no detached vertical blocks.
    // Rounded nacelles with dark forward inlets.
    const engine=[[0,-.011],[.003,-.010],[.0042,-.006],[.0042,.007],[.0035,.010],[0,.010]];
    add('white',new THREE.LatheGeometry(engine.map(p=>new THREE.Vector2(...p)),12),[side*.018,-.007,.004],[Math.PI/2,0,0]);
    add('glass',new THREE.CircleGeometry(.00325,12),[side*.018,-.007,.0143]);
    add('livery',new THREE.BoxGeometry(.0005,.002,.057),[side*.006,.0007,-.002]);
    for(let i=0;i<9;i++)add('glass',new THREE.SphereGeometry(1,6,4),[side*.0058,.003,.025-i*.0055],[0,0,0],[.00075,.0008,.0011]);
  }
  add('livery',panel([[-.047,.003],[-.053,.021],[-.041,.020],[-.027,.003]],.0016),[.0008,0,0],[0,-Math.PI/2,0]);
  add('accent',panel([[-.046,.010],[-.049,.017],[-.044,.017],[-.038,.010]],.0018),[.0009,0,0],[0,-Math.PI/2,0]);
  add('glass',new THREE.SphereGeometry(1,12,8),[0,.0047,.040],[.12,0,0],[.0045,.0019,.005]);
  return Object.fromEntries(Object.entries(parts).map(([key,geometries])=>{
    const size=geometries.reduce((n,g)=>n+g.attributes.position.array.length,0);
    const positions=new Float32Array(size),normals=new Float32Array(size);let offset=0;
    for(const geometry of geometries){positions.set(geometry.attributes.position.array,offset);normals.set(geometry.attributes.normal.array,offset);offset+=geometry.attributes.position.array.length;geometry.dispose();}
    const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));merged.computeBoundingSphere();
    return [key,merged];
  }));
}
