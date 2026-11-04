# ASCII 草浪

黄绿色 ASCII 草浪的两种呈现：版本1为平滑循环视频，版本2为实时 GPU 草叶。

[打开在线预览](https://shataojin.github.io/ascii-grass-wallpaper/) · [下载壁纸和 Unity 工程](https://github.com/shataojin/ascii-grass-wallpaper/releases/latest)

![版本1：成片转向的循环草浪](docs/reference-video/poster-visible.jpg)

| 版本 | 呈现方式 | 使用场景 |
| --- | --- | --- |
| 版本1 | 以生成底图为草叶采色，固定草根、明显成片转向，明暗随朝向变化，稳定字形，10 秒循环 | 横屏视频壁纸、Unity VideoPlayer |
| 版本2 | 160000 根 GPU 草叶，草根固定，相邻草叶共享风向，区域错开转向，字符跟随方向场 | 可调整风速和亮度的动态桌面、Unity 场景 |

## 在线预览

打开预览后可切换“版本1”和“版本2”，均适应横屏。H 显示设置，空格暂停。

网页右下角显示 Sha Taojin 和 GitHub 头像，默认 35% 不透明度。点击“水印”调节不透明度，调到 0% 即可隐藏；选择会保存在当前浏览器中。Wallpaper Engine 的属性面板也提供相同调节器。

## Wallpaper Engine

在 Releases 中下载所需包并解压：

- `Version1-Wallpaper.zip`：导入 `index.html` 为 Web 壁纸，可调节水印；也可直接导入 `grass-visible.mp4` 播放横屏视频。
- `Version2-Wallpaper.zip`：在 Wallpaper Engine 中创建 Web 壁纸，导入包内 `index.html`。资源均已包含，可完全离线运行。

也可以直接下载整个仓库：两个壁纸源文件分别位于 `docs/reference-video` 和 `docs/realtime`。

## Unity

建议使用 Unity **6000.3.21f1**，内置渲染管线（Built-in）。通过 Unity Hub 添加仓库内 `Unity-ASCII-Grass` 目录。

- `Assets/ASCIIGrass/Scenes/01_Reference_Portrait.unity`：实时竖幅。
- `Assets/ASCIIGrass/Scenes/02_Desktop_Wallpaper.unity`：实时横幅。
- `Assets/ASCIIGrass/Scenes/03_Original_Video_Motion.unity`：版本1横屏扩图视频。

在 Play 模式按 H 打开设置、空格暂停、F11 切换全屏。视频位于 `Assets/StreamingAssets/VideoReference`。导入其他项目时，可使用 Release 附带的 `ASCII-Grass.unitypackage`。


