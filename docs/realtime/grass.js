/* Offline WebGL2 renderer. No libraries, network resources, audio or telemetry. */
"use strict";
const grassSettings = { speed:1, wind:.75, columns:620, ascii:.64, exposure:1.08, composition:0, reference:3, interaction:false, fps:60, paused:false };
// Register synchronously: Wallpaper Engine may deliver properties before images load.
window.wallpaperPropertyListener = {
  applyUserProperties(properties) {
    for (const key of ["speed","wind","columns","ascii","exposure","composition","reference","interaction"])
      if (properties[key]) grassSettings[key] = key === "interaction" ? !!properties[key].value : Number(properties[key].value);
    if (window.asciiGrass) window.asciiGrass.settingsChanged();
  },
  applyGeneralProperties(properties) { if (properties.fps) grassSettings.fps = Math.max(1,Math.min(144,Number(properties.fps))); },
  setPaused(value) { grassSettings.paused = !!value; }
};

(async function () {
  const canvas = document.getElementById("grass");
  const message = document.getElementById("message");
  const params = new URLSearchParams(location.search);
  const validating = params.has("validate");
  const gl = canvas.getContext("webgl2",{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:"low-power",preserveDrawingBuffer:validating});
  async function sendReport(report) {
    if (validating && location.hostname === "127.0.0.1")
      await fetch("/__validation", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(report)});
  }
  function showError(error) { message.hidden=false;message.textContent="草浪渲染无法启动\n"+String(error.message||error);sendReport({passed:false,error:String(error.stack||error)}).catch(()=>{}); }
  if (!gl) { showError(new Error("需要支持 WebGL 2 的显卡和浏览器。"));return; }
  try {
    const common = `
uniform sampler2D _ReferenceTex;
uniform sampler2D _WindTex;
uniform vec4 _CropRect;
uniform vec4 _Settings;
uniform vec4 _Art;
uniform vec2 _Pointer;
uniform float _PointerForce;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 smoothPatch(vec2 f){return f*f*f*(f*(f*6.0-15.0)+10.0);}
float cohortTurn(vec2 cell,float phase){
 float lag=hash21(cell+19.7)*6.2831853;
 return sin(phase+lag)*.72+sin(phase*2.0-lag*.67)*.28;
}
vec4 windField(vec2 p){
 vec2 q=p*vec2(_Settings.z,1.0);
 vec2 patches=q*3.4+vec2(.22*sin(q.y*4.1),.18*sin(q.x*2.8));
 vec2 cell=floor(patches),f=smoothPatch(fract(patches));
 float a=cohortTurn(cell,_Settings.x),b=cohortTurn(cell+vec2(1,0),_Settings.x);
 float c=cohortTurn(cell+vec2(0,1),_Settings.x),d=cohortTurn(cell+vec2(1,1),_Settings.x);
 float region=mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
 float front=sin(_Settings.x-q.x*2.7+q.y*4.1+sin(q.y*2.3)*.6);
 float turn=region*.78+front*.40;
 float angle=.88+sin(q.x*2.1+q.y*1.9)*.10+turn*_Settings.y;
 vec2 delta=(p-_Pointer)*vec2(_Settings.z,1);
 angle+=delta.x*exp(-dot(delta,delta)*32.0)*_PointerForce*3.0;
 return vec4(vec2(sin(angle),cos(angle))*.5+.5,turn*.25+.5,1);
}
vec3 sampleWind(vec2 p){
 vec3 value=textureLod(_WindTex,clamp(p,0.0,1.0),0.0).rgb;
 return vec3(normalize(value.rg*2.0-1.0),value.b);
}
vec2 pictureUV(vec2 p){
 if(_Art.w<.5){p=(p-.5)*min(vec2(1),vec2(_Settings.z/_Settings.w,_Settings.w/_Settings.z))+.5;}
 return _CropRect.xy+clamp(p,0.0,1.0)*_CropRect.zw;
}
vec3 fieldColor(vec2 p){return textureLod(_ReferenceTex,pictureUV(p),0.0).rgb;}
float luminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
`;
    const screenVertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(gl_VertexID==1?3.0:-1.0,gl_VertexID==2?3.0:-1.0);gl_Position=vec4(p,0,1);uv=p*.5+.5;}`;
    const windFragment = `#version 300 es
precision highp float;
in vec2 uv;out vec4 outColor;
${common}
void main(){outColor=windField(uv);}`;
    const backgroundFragment = `#version 300 es
precision highp float;
in vec2 uv;out vec4 outColor;
${common}
void main(){
 vec2 delta=vec2(.008/_Settings.z,.008);
 vec3 c=fieldColor(uv)*.40;
 c+=fieldColor(uv+vec2(delta.x,0))*.15+fieldColor(uv-vec2(delta.x,0))*.15;
 c+=fieldColor(uv+vec2(0,delta.y))*.15+fieldColor(uv-vec2(0,delta.y))*.15;
 outColor=vec4(c*.54,1);
}`;
    const bladeVertex = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 vertex;
out vec2 bladeUV;out vec3 bladeColor;out float bladeAlpha;
${common}
void main(){
 vec2 cell=vec2(gl_InstanceID%400,399-gl_InstanceID/400);
 float h=hash21(cell),j=hash21(cell+42.3);
 vec2 root=(cell+vec2(h,j))/400.0;
 vec3 color=fieldColor(root);float lum=luminance(color);
 vec3 wind=sampleWind(root);
 float flutter=((h-.5)*.15+sin(_Settings.x*3.0+j*6.2831853)*.075)*_Settings.y;
 float sf=sin(flutter),cf=cos(flutter);
 vec2 direction=vec2(wind.x*cf+wind.y*sf,wind.y*cf-wind.x*sf);
 float restAngle=.88+(h-.5)*.38;
 vec2 rest=vec2(sin(restAngle),cos(restAngle));
 float height=(.016+h*.024)*(.78+lum*.5),t=vertex.y,t2=t*t,t3=t2*t;
 vec2 offset=height*(rest*(.9*(t-2.0*t2+t3))+direction*(2.1*t2-1.1*t3));
 vec2 tangent=normalize(rest*(.9*(1.0-4.0*t+3.0*t2))+direction*(4.2*t-3.3*t2));
 vec2 normal=vec2(tangent.y,-tangent.x);
 float width=.0020*(.72+j*.56)*(1.0-t*.94);
 offset+=normal*vertex.x*width;offset.x/=max(.35,_Settings.z);
 gl_Position=vec4((root+offset)*2.0-1.0,.5,1);
 float light=.82+.24*dot(direction,vec2(.68,.7332));
 bladeUV=vec2(vertex.x+.5,t);bladeColor=color*(.70+t*.58+j*.12)*light;bladeAlpha=.78+h*.18;
}`;
    const bladeFragment = `#version 300 es
precision highp float;
in vec2 bladeUV;in vec3 bladeColor;in float bladeAlpha;out vec4 outColor;
void main(){float edge=pow(clamp(1.0-abs(bladeUV.x*2.0-1.0),0.0,1.0),.4);outColor=vec4(bladeColor,bladeAlpha*edge*(1.0-smoothstep(.65,1.0,bladeUV.y)));}`;
    const asciiFragment = `#version 300 es
precision highp float;
in vec2 uv;out vec4 outColor;
uniform sampler2D _MainTex;uniform sampler2D _GlyphAtlas;
${common}
void main(){
 vec2 artUV=uv;
 if(_Art.w>.5){vec2 frameSize=min(vec2(1),vec2(_Settings.w/_Settings.z,_Settings.z/_Settings.w));artUV=(uv-.5)/frameSize+.5;if(any(lessThan(artUV,vec2(0)))||any(greaterThan(artUV,vec2(1)))){outColor=vec4(0,0,0,1);return;}}
 float columns=max(80.0,_Art.z),aspect=_Art.w>.5?_Settings.w:_Settings.z;
 vec2 grid=vec2(columns,columns/aspect*.76),cell=floor(artUV*grid),center=(cell+.5)/grid;
 vec3 source=texture(_MainTex,artUV).rgb,c=texture(_MainTex,center).rgb;
 float glyph=floor(clamp(pow(luminance(c),.85)*15.0+hash21(cell)*1.5,0.0,15.0));
 vec2 local=fract(artUV*grid)-.5;
 vec3 wind=sampleWind(center);float theta=(atan(wind.x,wind.y)-.88)*.80;
 float s=sin(theta),co=cos(theta);local=vec2(co*local.x-s*local.y,s*local.x+co*local.y)+.5;
 float inside=step(0.0,local.x)*step(local.x,1.0)*step(0.0,local.y)*step(local.y,1.0);
 float mask=texture(_GlyphAtlas,vec2((glyph+clamp(local.x,0.0,1.0))/16.0,local.y)).r*inside;
 vec3 ascii=mix(source*.72,c*1.45,mask);
 vec3 color=mix(source,ascii,_Art.y)*_Art.x;
 color*=.955+.045*cos(artUV.y*2800.0);
 outColor=vec4(clamp(color,0.0,1.0),1);
}`;
    function compile(type,source) {
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    function program(vertex,fragment) {
      const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const uniforms={};for(const name of ["_ReferenceTex","_WindTex","_MainTex","_GlyphAtlas","_CropRect","_Settings","_Art","_Pointer","_PointerForce"]) uniforms[name]=gl.getUniformLocation(p,name);
      return {p,uniforms};
    }
    const programs={wind:program(screenVertex,windFragment),background:program(screenVertex,backgroundFragment),blades:program(bladeVertex,bladeFragment),ascii:program(screenVertex,asciiFragment)};
    const screenVAO=gl.createVertexArray();
    const bladeVAO=gl.createVertexArray();gl.bindVertexArray(bladeVAO);
    const vertices=[];
    for(let n=0;n<3;n++) {const a=n/3,b=(n+1)/3;vertices.push(-.5,a,-.5,b,.5,a,.5,a,-.5,b,.5,b);}
    const vertexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    const refs={};
    function makeTexture() {
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return texture;
    }
    await Promise.all([3].map(n=>new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>{const tex=makeTexture();gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);refs[n]=tex;resolve();};image.onerror=()=>reject(new Error("参考纹理读取失败"));image.src=window.ASCII_GRASS_ASSETS[n];
    })));
    const glyphs=[
      "00000/00000/00000/00000/00000/00100/00000","00000/00000/00100/00000/00000/00100/00000",
      "00000/00000/00100/00000/00000/00100/01000","00100/00000/00100/00100/00100/00100/00000",
      "00100/00100/00100/00100/00000/00100/00000","00000/00100/00100/11111/00100/00100/00000",
      "00000/10101/01110/11111/01110/10101/00000","00000/00000/01110/10001/10001/01110/00000",
      "00000/10001/01010/00100/01010/10001/00000","11001/11010/00100/01000/10110/00110/00000",
      "01010/01010/11111/01010/11111/01010/01010","01110/10001/10101/10101/10111/10000/01110",
      "11110/10001/11110/10001/10001/11110/00000","10001/11011/10101/10101/10001/10001/10001",
      "10001/10001/10101/10101/10101/11011/10001","11111/11111/11011/11111/11011/11111/11111"
    ];
    const glyphPixels=new Uint8Array(96*8*4);
    glyphs.forEach((glyph,g)=>glyph.split("/").forEach((row,y)=>[...row].forEach((bit,x)=>{const at=((7-y)*96+g*6+x)*4;glyphPixels[at]=glyphPixels[at+1]=glyphPixels[at+2]=bit==="1"?255:0;glyphPixels[at+3]=255;})));
    const atlas=makeTexture();gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,96,8,0,gl.RGBA,gl.UNSIGNED_BYTE,glyphPixels);
    let target=null,targetTexture=null,targetWidth=0,targetHeight=0;
    let windTarget=null,windTexture=null,windWidth=0;
    let seconds=0,previous=performance.now(),lastFrame=0;
    let pointer=[-10,-10],pointerForce=0;
    function referenceInfo(){return grassSettings.reference===3?{crop:[0,0,1,1],aspect:16/9}:grassSettings.reference===1?{crop:[177/590,895/1280,236/590,296/1280],aspect:236/296}:{crop:[0,292/1280,1,830/1280],aspect:590/830};}
    function configure(p,aspect,phase,ref,portrait) {
      gl.useProgram(p.p);const u=p.uniforms;
      gl.uniform4f(u._Settings,phase,grassSettings.wind,aspect,ref.aspect);
      gl.uniform4f(u._Art,grassSettings.exposure,grassSettings.ascii,grassSettings.columns,portrait);
      gl.uniform4fv(u._CropRect,ref.crop);gl.uniform2fv(u._Pointer,pointer);gl.uniform1f(u._PointerForce,grassSettings.interaction?pointerForce:0);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,refs[grassSettings.reference]||refs[2]);gl.uniform1i(u._ReferenceTex,0);
      gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,windTexture);gl.uniform1i(u._WindTex,3);gl.activeTexture(gl.TEXTURE0);
    }
    function render(time,width,height) {
      if(!width){const dpr=Math.min(devicePixelRatio||1,1.5),scale=Math.min(1,2880/(innerWidth*dpr),1620/(innerHeight*dpr));width=Math.max(1,Math.round(innerWidth*dpr*scale));height=Math.max(1,Math.round(innerHeight*dpr*scale));}
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      const ref=referenceInfo(),aspect=width/height,portrait=grassSettings.composition===1;
      const artAspect=portrait?ref.aspect:aspect,artWidth=portrait?Math.min(3840,Math.round(height*artAspect)):width;
      if(targetWidth!==artWidth||targetHeight!==height){
        if(targetTexture)gl.deleteTexture(targetTexture);if(target)gl.deleteFramebuffer(target);
        targetTexture=makeTexture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,artWidth,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        target=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,targetTexture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error("无法创建渲染目标");
        targetWidth=artWidth;targetHeight=height;
      }
      const phase=((time%12)+12)%12/12*Math.PI*2;
      const fieldWidth=Math.max(128,Math.min(512,Math.round(192*artAspect)));
      if(windWidth!==fieldWidth){
        if(windTexture)gl.deleteTexture(windTexture);if(windTarget)gl.deleteFramebuffer(windTarget);
        windTexture=makeTexture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fieldWidth,192,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        windTarget=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,windTarget);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,windTexture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error("无法创建风场目标");windWidth=fieldWidth;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,windTarget);gl.viewport(0,0,fieldWidth,192);gl.disable(gl.BLEND);
      gl.bindVertexArray(screenVAO);configure(programs.wind,artAspect,phase,ref,portrait?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,artWidth,height);gl.disable(gl.BLEND);
      gl.bindVertexArray(screenVAO);configure(programs.background,artAspect,phase,ref,portrait?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(bladeVAO);configure(programs.blades,artAspect,phase,ref,portrait?1:0);gl.drawArraysInstanced(gl.TRIANGLES,0,18,160000);
      gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
      gl.bindVertexArray(screenVAO);configure(programs.ascii,aspect,phase,ref,portrait?1:0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,targetTexture);gl.uniform1i(programs.ascii.uniforms._MainTex,1);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,atlas);gl.uniform1i(programs.ascii.uniforms._GlyphAtlas,2);
      gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
    }
    function updateControls() {
      for(const key of ["speed","wind","columns","ascii","exposure"]){document.getElementById(key).value=grassSettings[key];document.getElementById(key+"Value").textContent=key==="columns"?grassSettings[key]:grassSettings[key].toFixed(2);}
      document.getElementById("composition").value=grassSettings.composition;document.getElementById("reference").value=grassSettings.reference;
      document.getElementById("pause").textContent=grassSettings.paused?"继续":"暂停";
    }
    for(const key of ["speed","wind","columns","ascii","exposure","composition","reference"])
      document.getElementById(key).addEventListener("input",e=>{grassSettings[key]=Number(e.target.value);updateControls();});
    const controls=document.getElementById("controls");
    controls.hidden=!params.has("controls");
    if(params.has("portrait")){grassSettings.composition=1;grassSettings.columns=300;}
    document.getElementById("pause").addEventListener("click",()=>{grassSettings.paused=!grassSettings.paused;updateControls();});
    document.getElementById("hide").addEventListener("click",()=>{controls.hidden=true;});
    document.addEventListener("keydown",e=>{if(e.target.matches("input,select"))return;if(e.code==="KeyH")controls.hidden=!controls.hidden;if(e.code==="Space"){e.preventDefault();grassSettings.paused=!grassSettings.paused;updateControls();}});
    canvas.addEventListener("dblclick",()=>{if(!document.fullscreenElement)canvas.requestFullscreen?.();else document.exitFullscreen?.();});
    canvas.addEventListener("pointermove",e=>{pointer=[e.clientX/innerWidth,1-e.clientY/innerHeight];pointerForce=.5;});
    canvas.addEventListener("pointerleave",()=>{pointerForce=0;});
    document.addEventListener("visibilitychange",()=>{previous=performance.now();});
    canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();grassSettings.paused=true;showError(new Error("显卡上下文暂时丢失，请重新加载壁纸。"));});
    canvas.addEventListener("webglcontextrestored",()=>location.reload());
    window.asciiGrass={settings:grassSettings,renderAt:render,settingsChanged:updateControls,bladeCount:160000,loopSeconds:12};
    updateControls();render(0);
    if(validating){
      const results=[],images={};
      for(const [name,w,h,mode] of [["Portrait",590,1000,1],["Desktop",1920,1080,0],["Ultrawide",2520,1080,0]]){
        grassSettings.composition=mode;grassSettings.columns=mode?300:620;
        let first;
        for(const t of [0,3,12]){
          render(t,w,h);gl.finish();
          const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let diff=0,brightness=0;for(let i=0;i<pixels.length;i+=4){brightness+=pixels[i+1];if(first)diff+=Math.abs(pixels[i]-first[i])+Math.abs(pixels[i+1]-first[i+1])+Math.abs(pixels[i+2]-first[i+2]);}
          diff/=w*h*3*255;brightness/=w*h;
          if(t===0)first=pixels;
          results.push({name,width:w,height:h,seconds:t,meanGreen:brightness,pixelDifference:diff,passed:brightness>10&&(t===0||t===3&&diff>.003||t===12&&diff<.0001)});
          if(t!==12)images[name+"-t"+t]=canvas.toDataURL("image/png");
        }
      }
      const error=gl.getError();const report={passed:results.every(x=>x.passed)&&error===gl.NO_ERROR,renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),glError:error,bladeCount:160000,loopSeconds:12,results,images};
      await sendReport(report);grassSettings.composition=params.has("portrait")?1:0;grassSettings.columns=grassSettings.composition?300:620;
      message.hidden=false;message.style.cssText="position:fixed;inset:auto;left:16px;top:16px;background:#102010;padding:12px;color:#dde9ce";message.textContent=report.passed?"PASS · 4 shaders · 160,000 blades · 3 aspect ratios · 12 s loop":"FAIL · See validation report";
    }
    function frame(now){requestAnimationFrame(frame);const delta=Math.min(.1,(now-previous)/1000);previous=now;if(!grassSettings.paused&&!document.hidden)seconds+=delta*grassSettings.speed;if(now-lastFrame<1000/grassSettings.fps-1)return;lastFrame=now;if(!document.hidden)render(seconds);}
    requestAnimationFrame(frame);
  }catch(error){showError(error);}
})();
