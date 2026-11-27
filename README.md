# 序日 Dayfolio

支持日、三日、周和月视图的本地日程规划工具。Windows 桌面版和网页版共用日历与分类界面。

## Windows 桌面版

完整解压 `Dayfolio-Windows-x64.zip`，运行其中的 `Dayfolio.exe`。桌面版适用于装有 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.7.2 或更高版本的 Windows 10/11 x64。日程数据保存在当前 Windows 用户的 `%LOCALAPPDATA%\Dayfolio\WebView2` 中。

在 Windows 上从源码构建：

```powershell
.\desktop\build.ps1
```

首次构建会从 NuGet 获取指定版本的 WebView2 SDK 并校验哈希。输出位于 `dist\Dayfolio\Dayfolio.exe` 和 `dist\Dayfolio-Windows-x64.zip`。

## 迁移网页日程

在原来使用的浏览器打开原来的 `index.html`，进入「设置 → 导出日程」。在桌面版的「设置 → 导入日程」选择该 JSON 文件。备份包含任务、分类、颜色、文件夹、排序和分类显示状态。导入前会确认替换当前日程。两个版本独立保存后续修改。

## 源码

- `desktop/Program.cs` 创建原生窗口并加载本地界面。
- `state.js` 管理共享状态、旧数据兼容和本地保存。
- `categories.js` 处理分类树、面板与分类编辑。
- `timeline.js` 处理时间轴布局、任务拖动和边缘滚动。
- `app.js` 负责主视图、任务编辑和显示设置。
- `backup.js` 负责备份验证、导入和导出。
