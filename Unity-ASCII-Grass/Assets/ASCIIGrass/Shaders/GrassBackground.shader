Shader "ASCIIGrass/Background" {
    Properties { _ReferenceTex("Reference",2D)="white"{} }
    SubShader {
        Cull Off ZWrite Off ZTest Always
        Pass {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #pragma target 3.5
            #include "UnityCG.cginc"
            #include "GrassCommon.cginc"
            float4 frag(v2f_img i) : SV_Target {
                float2 delta = float2(.008 / _Settings.z, .008);
                float3 c = fieldColor(i.uv) * .40;
                c += fieldColor(i.uv + float2(delta.x,0)) * .15;
                c += fieldColor(i.uv - float2(delta.x,0)) * .15;
                c += fieldColor(i.uv + float2(0,delta.y)) * .15;
                c += fieldColor(i.uv - float2(0,delta.y)) * .15;
                // Only a still, soft bed of color remains behind the moving blades.
                return float4(c * .54, 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
