# 序日 Dayfolio

序日是一款 Windows 本地日程规划应用，支持日、三日、周和月视图。可以在日历上拖动任务、拉动边缘调整起止时间，用分类和文件夹管理任务。

## 运行

将 `Dayfolio-Windows-x64.zip` 完整解压到一个文件夹，双击 `Dayfolio.exe`。支持安装了 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.7.2 或更高版本的 Windows 10/11 x64。界面资源内置于程序，日常使用可离线进行。

## 数据与备份

日程和设置保存在当前用户的 `%LOCALAPPDATA%\Dayfolio\WebView2`。在「设置 → 导出日程」可将任务、分类和文件夹保存为 JSON 文件。换电脑时，在新电脑上进入「设置 → 导入日程」，选择备份并确认替换。

## 从源码构建

在 Windows 上运行以下 PowerShell 命令。

```powershell
.\desktop\build.ps1
```

首次构建会从 NuGet 获取指定版本的 WebView2 SDK 并校验哈希。构建脚本将 `desktop/ui` 的界面资源编入程序，生成 `dist\Dayfolio\Dayfolio.exe` 和 `dist\Dayfolio-Windows-x64.zip`。
