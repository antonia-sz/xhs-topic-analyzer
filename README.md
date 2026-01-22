# 选题分析助手 Chrome 插件

一个用于提取页面笔记信息并调用 API 进行选题分析的 Chrome 侧边栏插件。

## 安装步骤

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本插件文件夹 `topic-analyzer`

## 配置 API Key

使用前需要配置 DeepSeek API Key：

1. 打开 `sidepanel.js` 文件
2. 找到第 7 行：`const API_KEY = '';`
3. 在引号中填入你的 DeepSeek API Key

## 使用方法

1. 点击浏览器工具栏中的插件图标，打开侧边栏
2. 打开包含 `id="detail-title"` 元素的笔记页面
3. 点击「提取主题」按钮提取页面信息
4. 点击「分析选题」按钮进行 AI 分析

## 功能说明

- **提取主题**：提取页面中 `id="detail-title"` 和 `id="detail-desc"` 元素的文字内容
- **分析选题**：将提取的内容发送给 DeepSeek API 进行分析
- 支持 Markdown 格式的分析结果显示

## 文件结构

```
topic-analyzer/
├── manifest.json      # 插件配置文件
├── background.js      # 后台脚本
├── sidepanel.html     # 侧边栏页面
├── sidepanel.js       # 侧边栏逻辑
├── styles.css         # 样式文件
├── lib/
│   └── marked.min.js  # Markdown 解析库
└── README.md          # 说明文档
```
