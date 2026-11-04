using System.IO;
using UnityEngine;
using UnityEngine.Video;

namespace ASCIIGrass
{
    [RequireComponent(typeof(Camera))]
    public sealed class ReferenceVideoRenderer : MonoBehaviour
    {
        public Shader displayShader;
        public Texture2D poster;
        public string relativeVideoPath = "VideoReference/grass-reference.mp4";
        public bool fillScreen;
        public bool showControls;
        VideoPlayer player;
        RenderTexture frames;
        Material display;

        void Start()
        {
            if (!displayShader) displayShader = Shader.Find("ASCIIGrass/ReferenceVideo");
            display = new Material(displayShader);
            frames = new RenderTexture(590,824,0,RenderTextureFormat.ARGB32) { name="Original grass video frames",filterMode=FilterMode.Bilinear };
            frames.Create();
            player = gameObject.AddComponent<VideoPlayer>();
            player.playOnAwake = false; player.source = VideoSource.Url;
            player.url = Path.Combine(Application.streamingAssetsPath,relativeVideoPath).Replace('\\','/');
            player.renderMode = VideoRenderMode.RenderTexture; player.targetTexture = frames;
            player.audioOutputMode = VideoAudioOutputMode.None;
            player.isLooping = true; player.waitForFirstFrame = true; player.skipOnDrop = false;
            player.prepareCompleted += Ready;
            player.errorReceived += Failed;
            player.Prepare();
        }
        void Ready(VideoPlayer source) { source.Play(); }
        void Failed(VideoPlayer source,string error) { Debug.LogError("Reference video: "+error,this); }
        void Update()
        {
            if (Input.GetKeyDown(KeyCode.H)) showControls = !showControls;
            if (Input.GetKeyDown(KeyCode.Space)) Toggle();
            if (Input.GetKeyDown(KeyCode.F11)) Screen.fullScreen = !Screen.fullScreen;
        }
        void Toggle() { if (!player || !player.isPrepared) return; if (player.isPlaying) player.Pause(); else player.Play(); }
        void OnRenderImage(RenderTexture source,RenderTexture destination)
        {
            if (!display) { Graphics.Blit(source,destination); return; }
            display.SetVector("_Layout",new Vector4(source.width/(float)source.height,590f/824f,fillScreen?1:0,0));
            Texture image = player && player.isPrepared && player.frame >= 0 ? frames : poster;
            if (image) Graphics.Blit(image,destination,display); else Graphics.Blit(source,destination);
        }
        void OnGUI()
        {
            if (!showControls) return;
            GUILayout.BeginArea(new Rect(18,18,260,130),GUI.skin.box);
            GUILayout.Label("ASCII GRASS / Original video motion");
            if (GUILayout.Button(player && player.isPlaying ? "Pause" : "Play")) Toggle();
            fillScreen=GUILayout.Toggle(fillScreen,"Fill screen (crops the portrait)");
            GUILayout.Label("H: controls / Space: pause / F11: fullscreen");
            GUILayout.EndArea();
        }
        void OnDestroy()
        {
            if (player) { player.prepareCompleted-=Ready;player.errorReceived-=Failed;player.Stop();Destroy(player); }
            if (frames) { frames.Release();Destroy(frames); }
            if (display) Destroy(display);
        }
    }
}
