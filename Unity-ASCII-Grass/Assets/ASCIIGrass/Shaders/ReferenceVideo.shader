Shader "ASCIIGrass/ReferenceVideo" {
    Properties { _MainTex("Video",2D)="black"{} }
    SubShader {
        Cull Off ZWrite Off ZTest Always
        Pass {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            float4 _Layout;
            float4 frag(v2f_img i) : SV_Target {
                float2 uv=i.uv;
                float2 size=float2(_Layout.y/_Layout.x,_Layout.x/_Layout.y);
                if (_Layout.z < .5) {
                    uv=(uv-.5)/min(float2(1,1),size)+.5;
                    if(any(uv<0)||any(uv>1))return float4(0,0,0,1);
                } else uv=(uv-.5)*min(float2(1,1),1.0/size)+.5;
                return tex2D(_MainTex,uv);
            }
            ENDCG
        }
    }
    Fallback Off
}
