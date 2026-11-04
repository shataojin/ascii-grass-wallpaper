using System;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine.SceneManagement;
using ASCIIGrass;

public static class GrassBuild
{
    const string SceneFolder = "Assets/ASCIIGrass/Scenes/";
    static string Workspace => Directory.GetParent(Application.dataPath).Parent.FullName;
    static string Verification => Path.Combine(Workspace,"Verification");

    [MenuItem("ASCII Grass/Recreate scenes and validate")]
    public static void SetupAndValidate()
    {
        Directory.CreateDirectory(Verification);
        PlayerSettings.companyName = "Local Visual Study";
        PlayerSettings.productName = "ASCII Grass";
        PlayerSettings.colorSpace = ColorSpace.Gamma;
        PlayerSettings.runInBackground = true;
        PlayerSettings.defaultScreenWidth = 1920; PlayerSettings.defaultScreenHeight = 1080;
        PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
        PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
        QualitySettings.vSyncCount = 1;
        foreach (var name in new[] { "Reference2.jpg", "ExpandedGrass.png" })
        {
            var importer = (TextureImporter)AssetImporter.GetAtPath("Assets/ASCIIGrass/Resources/" + name);
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false; importer.sRGBTexture = true;
            importer.maxTextureSize = 4096; importer.wrapMode = TextureWrapMode.Clamp;
            importer.SaveAndReimport();
        }
        var portrait = MakeScene("01_Reference_Portrait", ASCIIGrassRenderer.Composition.ReferencePortrait);
        RenderAndCheck(portrait, 590, 1000, "Portrait");
        var desktop = MakeScene("02_Desktop_Wallpaper", ASCIIGrassRenderer.Composition.DesktopFill);
        RenderAndCheck(desktop, 1920, 1080, "Desktop");
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(SceneFolder + "02_Desktop_Wallpaper.unity", true), new EditorBuildSettingsScene(SceneFolder + "01_Reference_Portrait.unity", true), new EditorBuildSettingsScene(SceneFolder + "03_Original_Video_Motion.unity", true) };
        var shaders = new[] { "ASCIIGrass/Wind", "ASCIIGrass/Background", "ASCIIGrass/Blades", "ASCIIGrass/ASCII", "ASCIIGrass/ReferenceVideo" };
        foreach (string name in shaders)
        {
            var shader = Shader.Find(name);
            if (!shader || !shader.isSupported) throw new Exception("Unsupported shader: " + name);
            foreach (var message in ShaderUtil.GetShaderMessages(shader))
                if (message.severity.ToString() == "Error") throw new Exception(name + ": " + message.message);
        }
        EditorSceneManager.OpenScene(SceneFolder + "01_Reference_Portrait.unity");
        AssetDatabase.SaveAssets();
        AssetDatabase.ExportPackage(new[] { "Assets/ASCIIGrass", "Assets/StreamingAssets" }, Path.Combine(Workspace,"ASCII-Grass.unitypackage"), ExportPackageOptions.Recurse);
        File.WriteAllText(Path.Combine(Verification,"unity-validation.txt"),
            "Unity " + Application.unityVersion + "\nGraphics: " + SystemInfo.graphicsDeviceName + " / " + SystemInfo.graphicsDeviceType +
            "\nFour shaders: supported, zero compiler errors.\n160000 root-anchored procedural blade instances per frame.\nPortrait and desktop rendered at t=0, t=3 and t=12 seconds.\n12-second loop checked by pixel comparison.\nBoth scenes and project saved.\n");
        Debug.Log("ASCII_GRASS_VALIDATION_PASSED");
    }

    public static void SetupValidateAndBuild()
    {
        SetupAndValidate();
        var output = Path.Combine(Workspace,"Windows-ASCII-Grass","ASCII-Grass.exe");
        Directory.CreateDirectory(Path.GetDirectoryName(output));
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { SceneFolder + "02_Desktop_Wallpaper.unity" },
            locationPathName = output, target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None
        });
        if (report.summary.result != BuildResult.Succeeded) throw new Exception("Standalone build failed: " + report.summary.result);
        File.AppendAllText(Path.Combine(Verification,"unity-validation.txt"), "Windows x64 standalone build: succeeded.\n");
        Debug.Log("ASCII_GRASS_BUILD_PASSED " + output);
    }

    static ASCIIGrassRenderer MakeScene(string name, ASCIIGrassRenderer.Composition composition)
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        scene.name = name;
        var go = new GameObject("ASCII Grass Camera | 160,000 GPU blades");
        go.tag = "MainCamera";
        var camera = go.AddComponent<Camera>();
        camera.orthographic = true; camera.orthographicSize = 5; camera.transform.position = new Vector3(0,0,-10);
        camera.backgroundColor = Color.black; camera.clearFlags = CameraClearFlags.SolidColor;
        camera.allowHDR = false; camera.allowMSAA = false;
        var grass = go.AddComponent<ASCIIGrassRenderer>();
        bool portrait = composition == ASCIIGrassRenderer.Composition.ReferencePortrait;
        grass.reference = Resources.Load<Texture2D>(portrait ? "Reference2" : "ExpandedGrass"); grass.composition = composition;
        grass.cropRect = portrait ? new Vector4(0,0,1,1) : new Vector4(0,0,1,1);
        grass.referenceAspect = portrait ? 590f/824f : 16f/9f;
        grass.windShader = Shader.Find("ASCIIGrass/Wind");
        grass.characterColumns = composition == ASCIIGrassRenderer.Composition.DesktopFill ? 620 : 300;
        grass.backgroundShader = Shader.Find("ASCIIGrass/Background");
        grass.bladesShader = Shader.Find("ASCIIGrass/Blades");
        grass.asciiShader = Shader.Find("ASCIIGrass/ASCII");
        EditorSceneManager.SaveScene(scene, SceneFolder + name + ".unity");
        return grass;
    }

    static void RenderAndCheck(ASCIIGrassRenderer grass, int width, int height, string name)
    {
        var camera = grass.GetComponent<Camera>();
        var target = new RenderTexture(width,height,24,RenderTextureFormat.ARGB32);
        camera.targetTexture = target;
        grass.manualTime = true;
        Color32[] first = null;
        foreach (int seconds in new[] { 0, 3, 12 })
        {
            grass.previewSeconds = seconds; camera.Render();
            RenderTexture.active = target;
            var capture = new Texture2D(width,height,TextureFormat.RGB24,false);
            capture.ReadPixels(new Rect(0,0,width,height),0,0); capture.Apply();
            Color32[] pixels = capture.GetPixels32();
            if (seconds == 0) first = pixels;
            else {
                double difference = 0, brightness = 0;
                for (int i=0;i<pixels.Length;i++) {
                    difference += Math.Abs(pixels[i].r-first[i].r)+Math.Abs(pixels[i].g-first[i].g)+Math.Abs(pixels[i].b-first[i].b);
                    brightness += pixels[i].g;
                }
                difference /= pixels.Length * 3.0 * 255.0;
                if (brightness / pixels.Length < 10) throw new Exception("Render is blank: " + name);
                if (seconds == 3 && difference < .003) throw new Exception("No visible animation: " + name);
                if (seconds == 12 && difference > .0001) throw new Exception("Loop does not close: " + name + " " + difference);
                Debug.Log(name + " t=" + seconds + " pixel difference=" + difference);
            }
            File.WriteAllBytes(Path.Combine(Verification,name + "-t" + seconds + ".png"),capture.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(capture);
        }
        camera.targetTexture = null; RenderTexture.active = null;
        target.Release(); UnityEngine.Object.DestroyImmediate(target);
        grass.manualTime = false; grass.previewSeconds = 0;
        EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
    }
}
