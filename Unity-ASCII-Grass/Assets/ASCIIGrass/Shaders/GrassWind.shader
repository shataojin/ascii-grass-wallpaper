Shader "ASCIIGrass/Wind" {
    SubShader {
        Cull Off ZWrite Off ZTest Always
        Pass {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #pragma target 3.5
            #include "UnityCG.cginc"
            #include "GrassCommon.cginc"
            float4 frag(v2f_img i) : SV_Target { return windField(i.uv); }
            ENDCG
        }
    }
    Fallback Off
}
