#ifndef ASCII_GRASS_COMMON
#define ASCII_GRASS_COMMON
sampler2D _ReferenceTex;
sampler2D _WindTex;
float4 _CropRect;
float4 _Settings; // phase, wind strength, aspect, reference aspect
float4 _Art; // exposure, ASCII blend, column count, portrait framing
float2 _Pointer;
float _PointerForce;

float hash21(float2 p) {
    return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}
float2 smoothPatch(float2 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
float cohortTurn(float2 cell, float phase) {
    float lag = hash21(cell + 19.7) * 6.2831853;
    return sin(phase + lag) * .72 + sin(phase * 2.0 - lag * .67) * .28;
}
float4 windField(float2 p) {
    float2 q = p * float2(_Settings.z, 1.0);
    float2 patches = q * 3.4 + float2(.22 * sin(q.y * 4.1), .18 * sin(q.x * 2.8));
    float2 cell = floor(patches), f = smoothPatch(frac(patches));
    float a = cohortTurn(cell, _Settings.x), b = cohortTurn(cell + float2(1,0), _Settings.x);
    float c = cohortTurn(cell + float2(0,1), _Settings.x), d = cohortTurn(cell + float2(1,1), _Settings.x);
    float region = lerp(lerp(a,b,f.x), lerp(c,d,f.x), f.y);
    float front = sin(_Settings.x - q.x * 2.7 + q.y * 4.1 + sin(q.y * 2.3) * .6);
    float turn = region * .78 + front * .40;
    float angle = .88 + sin(q.x * 2.1 + q.y * 1.9) * .10 + turn * _Settings.y;
    float2 delta = (p - _Pointer) * float2(_Settings.z,1);
    angle += delta.x * exp(-dot(delta,delta) * 32.0) * _PointerForce * 3.0;
    return float4(float2(sin(angle),cos(angle)) * .5 + .5, turn * .25 + .5, 1);
}
float3 sampleWind(float2 p) {
    float3 value = tex2Dlod(_WindTex, float4(saturate(p),0,0)).rgb;
    return float3(normalize(value.rg * 2.0 - 1.0), value.b);
}
float2 pictureUV(float2 p) {
    if (_Art.w < .5) {
        // Cover from a complete image; crop excess without reflections or stretching.
        p = (p - .5) * min(float2(1,1), float2(_Settings.z / _Settings.w, _Settings.w / _Settings.z)) + .5;
    }
    return _CropRect.xy + saturate(p) * _CropRect.zw;
}
float3 referenceColor(float2 p) {
    return tex2Dlod(_ReferenceTex, float4(pictureUV(p), 0, 0)).rgb;
}
float3 fieldColor(float2 p) {
    // Source colors stay attached to roots; the photograph is never advected.
    return referenceColor(p);
}
float luminance(float3 c) { return dot(c, float3(.2126, .7152, .0722)); }
#endif
