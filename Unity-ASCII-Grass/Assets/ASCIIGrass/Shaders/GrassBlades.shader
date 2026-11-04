Shader "ASCIIGrass/Blades" {
    Properties { _ReferenceTex("Reference",2D)="white"{} }
    SubShader {
        Cull Off ZWrite Off ZTest Always
        Blend SrcAlpha OneMinusSrcAlpha
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 4.5
            #include "UnityCG.cginc"
            #include "GrassCommon.cginc"
            struct input { float4 vertex : POSITION; float2 uv : TEXCOORD0; uint id : SV_InstanceID; };
            struct output { float4 position : SV_POSITION; float2 uv : TEXCOORD0; float3 color : TEXCOORD1; float alpha : TEXCOORD2; };
            output vert(input v) {
                output o;
                // Draw far roots first; lower roots overlap them like real grass.
                float2 cell = float2(v.id % 400, 399 - v.id / 400);
                float h = hash21(cell);
                float j = hash21(cell + 42.3);
                float2 root = (cell + float2(h,j)) / 400.0;
                float3 color = fieldColor(root);
                float lum = luminance(color);
                float3 wind = sampleWind(root);
                float flutter = ((h - .5) * .15 + sin(_Settings.x * 3.0 + j * 6.2831853) * .075) * _Settings.y;
                float sf = sin(flutter), cf = cos(flutter);
                float2 direction = float2(wind.x * cf + wind.y * sf, wind.y * cf - wind.x * sf);
                float restAngle = .88 + (h - .5) * .38;
                float2 rest = float2(sin(restAngle),cos(restAngle));
                float height = (.016 + h * .024) * (.78 + lum * .5);
                float t = v.uv.y;
                float t2 = t * t, t3 = t2 * t;
                // Cubic blade: its root stays planted while the middle and tip turn.
                float2 offset = height * (rest * (.9 * (t - 2.0*t2 + t3)) + direction * (2.1*t2 - 1.1*t3));
                float2 tangent = normalize(rest * (.9 * (1.0 - 4.0*t + 3.0*t2)) + direction * (4.2*t - 3.3*t2));
                float2 normal = float2(tangent.y,-tangent.x);
                float width = .0020 * (.72 + j * .56) * (1.0 - t * .94);
                offset += normal * v.vertex.x * width;
                offset.x /= max(.35, _Settings.z);
                o.position = float4((root + offset) * 2.0 - 1.0, .5, 1.0);
                // Offscreen rendering uses bottom-left texture coordinates.
                #if UNITY_UV_STARTS_AT_TOP
                    o.position.y *= -1;
                #endif
                o.uv = v.uv;
                float light = .82 + .24 * dot(direction,float2(.68,.7332));
                o.color = color * (.70 + t * .58 + j * .12) * light;
                o.alpha = .78 + h * .18;
                return o;
            }
            float4 frag(output i) : SV_Target {
                float edge = pow(saturate(1.0 - abs(i.uv.x * 2.0 - 1.0)), .4);
                return float4(i.color, i.alpha * edge * (1.0 - smoothstep(.65, 1.0, i.uv.y)));
            }
            ENDCG
        }
    }
    Fallback Off
}
