using UnityEngine;
using UnityEngine.Rendering;

namespace ASCIIGrass
{
    [ExecuteAlways, RequireComponent(typeof(Camera))]
    public sealed class ASCIIGrassRenderer : MonoBehaviour
    {
        public enum Composition { DesktopFill, ReferencePortrait }
        [Header("Reference composition")]
        public Texture2D reference;
        public Vector4 cropRect = new Vector4(0f, 0f, 1f, 1f);
        public float referenceAspect = 16f / 9f;
        public Composition composition = Composition.ReferencePortrait;
        [Header("A seamless 12-second cycle at speed 1")]
        [Range(0f, 3f)] public float speed = 1f;
        [Range(0f, 2f)] public float windStrength = .75f;
        [Range(.25f, 2f)] public float exposure = 1.08f;
        [Range(0f, 1f)] public float asciiBlend = .64f;
        [Range(80, 700)] public int characterColumns = 300;
        public bool paused;
        public bool showControls;
        public bool pointerInteraction;
        [Header("Deterministic preview / export")]
        public bool manualTime;
        public float previewSeconds;
        [Header("Shaders")]
        public Shader windShader;
        public Shader backgroundShader;
        public Shader bladesShader;
        public Shader asciiShader;

        public const int BladeCount = 160000;
        public const float LoopSeconds = 12f;
        public static readonly string[] GlyphRows = {
            "00000/00000/00000/00000/00000/00100/00000",
            "00000/00000/00100/00000/00000/00100/00000",
            "00000/00000/00100/00000/00000/00100/01000",
            "00100/00000/00100/00100/00100/00100/00000",
            "00100/00100/00100/00100/00000/00100/00000",
            "00000/00100/00100/11111/00100/00100/00000",
            "00000/10101/01110/11111/01110/10101/00000",
            "00000/00000/01110/10001/10001/01110/00000",
            "00000/10001/01010/00100/01010/10001/00000",
            "11001/11010/00100/01000/10110/00110/00000",
            "01010/01010/11111/01010/11111/01010/01010",
            "01110/10001/10101/10101/10111/10000/01110",
            "11110/10001/11110/10001/10001/11110/00000",
            "10001/11011/10101/10101/10001/10001/10001",
            "10001/10001/10101/10101/10101/11011/10001",
            "11111/11111/11011/11111/11011/11111/11111"
        };

        Material windMaterial, backgroundMaterial, bladesMaterial, asciiMaterial;
        Mesh bladeMesh;
        Texture2D glyphAtlas;
        CommandBuffer draw;
        double previousTime;
        float clock;
        float pointerForce;
        Vector2 pointer = new Vector2(-10f, -10f);

        public float Phase => Mathf.Repeat(manualTime ? previewSeconds : clock, LoopSeconds) / LoopSeconds * Mathf.PI * 2f;
        void OnEnable() { previousTime = Time.realtimeSinceStartupAsDouble; }
        void Update()
        {
            double now = Time.realtimeSinceStartupAsDouble;
            if (Application.isPlaying && !paused) clock += (float)System.Math.Min(.1, now - previousTime) * speed;
            previousTime = now;
            if (!Application.isPlaying) return;
            if (Input.GetKeyDown(KeyCode.H)) showControls = !showControls;
            if (Input.GetKeyDown(KeyCode.Space)) paused = !paused;
            if (Input.GetKeyDown(KeyCode.F11)) Screen.fullScreen = !Screen.fullScreen;
            if (pointerInteraction)
            {
                pointer = new Vector2(Input.mousePosition.x / Mathf.Max(1, Screen.width), Input.mousePosition.y / Mathf.Max(1, Screen.height));
                pointerForce = Mathf.MoveTowards(pointerForce, Input.GetMouseButton(0) ? 1f : .25f, Time.unscaledDeltaTime * 2f);
            }
            else pointerForce = 0f;
        }

        public static Texture2D CreateGlyphAtlas()
        {
            var texture = new Texture2D(96, 8, TextureFormat.RGBA32, false, true) { name = "ASCII 5x7 glyph atlas", filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.HideAndDontSave };
            var pixels = new Color32[96 * 8];
            for (int g = 0; g < GlyphRows.Length; g++)
            {
                string[] rows = GlyphRows[g].Split('/');
                for (int y = 0; y < 7; y++)
                    for (int x = 0; x < 5; x++)
                        pixels[(7 - y) * 96 + g * 6 + x] = rows[y][x] == '1' ? new Color32(255,255,255,255) : new Color32(0,0,0,255);
            }
            texture.SetPixels32(pixels); texture.Apply();
            return texture;
        }

        bool Prepare()
        {
            if (!reference) reference = Resources.Load<Texture2D>("ExpandedGrass");
            if (!windShader) windShader = Shader.Find("ASCIIGrass/Wind");
            if (!backgroundShader) backgroundShader = Shader.Find("ASCIIGrass/Background");
            if (!bladesShader) bladesShader = Shader.Find("ASCIIGrass/Blades");
            if (!asciiShader) asciiShader = Shader.Find("ASCIIGrass/ASCII");
            if (!reference || !windShader || !backgroundShader || !bladesShader || !asciiShader) return false;
            if (!windMaterial) windMaterial = new Material(windShader) { hideFlags = HideFlags.HideAndDontSave };
            if (!backgroundMaterial) backgroundMaterial = new Material(backgroundShader) { hideFlags = HideFlags.HideAndDontSave };
            if (!bladesMaterial) bladesMaterial = new Material(bladesShader) { hideFlags = HideFlags.HideAndDontSave, enableInstancing = true };
            if (!asciiMaterial) asciiMaterial = new Material(asciiShader) { hideFlags = HideFlags.HideAndDontSave };
            if (!glyphAtlas) glyphAtlas = CreateGlyphAtlas();
            if (!bladeMesh)
            {
                const int segments = 3;
                var positions = new Vector3[(segments + 1) * 2];
                var uvs = new Vector2[positions.Length];
                var indices = new int[segments * 6];
                for (int s = 0; s <= segments; s++)
                {
                    float t = s / (float)segments;
                    positions[s * 2] = new Vector3(-.5f, t, 0f);
                    positions[s * 2 + 1] = new Vector3(.5f, t, 0f);
                    uvs[s * 2] = new Vector2(0f, t); uvs[s * 2 + 1] = new Vector2(1f, t);
                    if (s == segments) continue;
                    int a = s * 2, k = s * 6;
                    indices[k] = a; indices[k+1] = a+2; indices[k+2] = a+1;
                    indices[k+3] = a+1; indices[k+4] = a+2; indices[k+5] = a+3;
                }
                bladeMesh = new Mesh { name = "Curved grass blade, 3 segments", hideFlags = HideFlags.HideAndDontSave };
                bladeMesh.vertices = positions; bladeMesh.uv = uvs; bladeMesh.triangles = indices;
                bladeMesh.bounds = new Bounds(Vector3.zero, Vector3.one * 100000f);
            }
            if (draw == null) draw = new CommandBuffer { name = "ASCII Grass: 160,000 GPU blades" };
            return true;
        }

        void Configure(Material material, float aspect)
        {
            material.SetTexture("_ReferenceTex", reference);
            material.SetVector("_CropRect", cropRect);
            material.SetVector("_Settings", new Vector4(Phase, windStrength, aspect, referenceAspect));
            material.SetVector("_Art", new Vector4(exposure, asciiBlend, characterColumns, (float)composition));
            material.SetVector("_Pointer", pointer);
            material.SetFloat("_PointerForce", pointerForce);
        }

        void OnRenderImage(RenderTexture source, RenderTexture destination)
        {
            if (!Prepare()) { Graphics.Blit(source, destination); return; }
            // The artwork is composed before framing, so portrait mode never stretches.
            float screenAspect = source.width / (float)source.height;
            bool framed = composition == Composition.ReferencePortrait;
            float artAspect = framed ? referenceAspect : screenAspect;
            int artWidth = framed ? Mathf.Max(1, Mathf.RoundToInt(source.height * artAspect)) : source.width;
            artWidth = Mathf.Min(artWidth, 3840);
            var scene = RenderTexture.GetTemporary(artWidth, source.height, 0, RenderTextureFormat.ARGB32);
            int windWidth = Mathf.Clamp(Mathf.RoundToInt(192 * artAspect),128,512);
            var wind = RenderTexture.GetTemporary(windWidth,192,0,RenderTextureFormat.ARGB32,RenderTextureReadWrite.Linear);
            wind.filterMode = FilterMode.Bilinear; wind.wrapMode = TextureWrapMode.Clamp;
            try
            {
                Configure(windMaterial,artAspect);
                Graphics.Blit(null,wind,windMaterial);
                Configure(backgroundMaterial, artAspect); Configure(bladesMaterial, artAspect); Configure(asciiMaterial, screenAspect);
                bladesMaterial.SetTexture("_WindTex",wind);
                asciiMaterial.SetTexture("_WindTex",wind);
                // The portrait composition already has its own correctly proportioned target.
                backgroundMaterial.SetVector("_Art", new Vector4(exposure,asciiBlend,characterColumns,1));
                if (!framed) backgroundMaterial.SetVector("_Art", new Vector4(exposure,asciiBlend,characterColumns,0));
                bladesMaterial.SetVector("_Art", new Vector4(exposure,asciiBlend,characterColumns,framed?1:0));
                Graphics.Blit(null, scene, backgroundMaterial);
                draw.Clear(); draw.SetRenderTarget(scene);
                draw.DrawMeshInstancedProcedural(bladeMesh, 0, bladesMaterial, 0, BladeCount);
                Graphics.ExecuteCommandBuffer(draw);
                asciiMaterial.SetTexture("_GlyphAtlas", glyphAtlas);
                Graphics.Blit(scene, destination, asciiMaterial);
            }
            finally { RenderTexture.ReleaseTemporary(scene); RenderTexture.ReleaseTemporary(wind); }
        }

        void OnGUI()
        {
            if (!showControls) return;
            GUI.color = new Color(1f,1f,1f,.94f);
            GUILayout.BeginArea(new Rect(18,18,300,350), GUI.skin.box);
            GUILayout.Label("ASCII GRASS / 160,000 GPU blades");
            GUILayout.Space(8);
            paused = GUILayout.Toggle(paused, "Pause / Space");
            pointerInteraction = GUILayout.Toggle(pointerInteraction, "Pointer wind");
            GUILayout.Label("Wind speed: " + speed.ToString("0.00")); speed = GUILayout.HorizontalSlider(speed,0f,3f);
            GUILayout.Label("Wind strength: " + windStrength.ToString("0.00")); windStrength = GUILayout.HorizontalSlider(windStrength,0f,2f);
            GUILayout.Label("ASCII: " + asciiBlend.ToString("0.00")); asciiBlend = GUILayout.HorizontalSlider(asciiBlend,0f,1f);
            GUILayout.Label("Columns: " + characterColumns); characterColumns = Mathf.RoundToInt(GUILayout.HorizontalSlider(characterColumns,80,700));
            GUILayout.Label("Exposure: " + exposure.ToString("0.00")); exposure = GUILayout.HorizontalSlider(exposure,.25f,2f);
            if (GUILayout.Button(composition == Composition.DesktopFill ? "Desktop fill / switch to portrait" : "Reference portrait / switch to desktop")) composition = composition == Composition.DesktopFill ? Composition.ReferencePortrait : Composition.DesktopFill;
            GUILayout.Label("H: hide controls / F11: fullscreen");
            GUILayout.EndArea();
        }

        void OnDisable()
        {
            if (draw != null) { draw.Release(); draw = null; }
            Release(windMaterial); Release(backgroundMaterial); Release(bladesMaterial); Release(asciiMaterial); Release(bladeMesh); Release(glyphAtlas);
        }
        static void Release(Object value) { if (!value) return; if (Application.isPlaying) Destroy(value); else DestroyImmediate(value); }
    }
}
