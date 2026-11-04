Shader "ASCIIGrass/ASCII" {
    Properties { _MainTex("Scene",2D)="white"{} _GlyphAtlas("Glyphs",2D)="white"{} }
    SubShader {
        Cull Off ZWrite Off ZTest Always
        Pass {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #pragma target 3.5
            #include "UnityCG.cginc"
            #include "GrassCommon.cginc"
            sampler2D _MainTex;
            sampler2D _GlyphAtlas;
            float4 frag(v2f_img i) : SV_Target {
                float2 uv = i.uv;
                float2 artUV = uv;
                if (_Art.w > .5) {
                    float2 frameSize = min(float2(1,1), float2(_Settings.w / _Settings.z, _Settings.z / _Settings.w));
                    artUV = (uv - .5) / frameSize + .5;
                    if (any(artUV < 0.0) || any(artUV > 1.0)) return float4(0,0,0,1);
                }
                float columns = max(80.0, _Art.z);
                float gridAspect = _Art.w > .5 ? _Settings.w : _Settings.z;
                float2 grid = float2(columns, columns / gridAspect * .76);
                float2 cell = floor(artUV * grid);
                float2 center = (cell + .5) / grid;
                float3 source = tex2D(_MainTex, artUV).rgb;
                float3 c = tex2D(_MainTex, center).rgb;
                float lum = luminance(c);
                float glyph = floor(clamp(pow(lum, .85) * 15.0 + hash21(cell) * 1.5, 0.0, 15.0));
                float2 local = frac(artUV * grid) - .5;
                float3 wind = sampleWind(center);
                float theta = (atan2(wind.x,wind.y) - .88) * .80;
                float s = sin(theta), co = cos(theta);
                local = float2(co * local.x - s * local.y, s * local.x + co * local.y) + .5;
                float inside = step(0.0,local.x)*step(local.x,1.0)*step(0.0,local.y)*step(local.y,1.0);
                float mask = tex2D(_GlyphAtlas, float2((glyph + saturate(local.x)) / 16.0, local.y)).r * inside;
                float3 ascii = lerp(source * .72, c * 1.45, mask);
                float3 finalColor = lerp(source, ascii, _Art.y) * _Art.x;
                // Fine horizontal grain is present in both supplied references.
                finalColor *= .955 + .045 * cos(artUV.y * 2800.0);
                return float4(saturate(finalColor), 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
