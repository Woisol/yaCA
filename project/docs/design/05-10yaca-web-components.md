# 关于组件库选型

专门针对 llm 场景的一些组件库
1. lobehub/ui
   本来第一眼选这个，结果一看依赖 antd 瞬间放弃……
2. assistant-ui.com/
   10k star！

我们现在来实现 apps/yaca-web，我现在的大概想法是，打算使用 assistant-ui 组件库（还没有安装依赖），桌面端分两栏，左栏放对话历史，右栏占主要面积，上方对话消息区，下方输入区 + StatusLine，StatusLine 展示模型、baseurl、cwd 等信息以及一个工具弹窗控制工具权限，还有一个开关控制 trust mode（toggle，trust mode 下允许模型所有工具调用）。移动端大致也接近，sidebar 变成抽屉即可。接口上，参考 05-10-yaca-web.md 中的接口设计。