# <img src="public/icons/icon_48.png" width="40" align="left" style="margin-right: 10px;"> DraftPaper

> **前端草稿纸** - 专业的页面布局对比和元素定位 Chrome 扩展

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=flat&logo=vue.js&logoColor=4FC08D)](https://vuejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-red?style=flat&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)

## ✨ 功能特色

WEB 前端开发者可以通过该插件将设计稿图片上传到开发预览页面作为样式开发底稿，并且可以对元素进行拖拽定位，从而获得拖拽后元素位置信息代码，极大提升了前端页面搭建效率及 UI 还原度。

### 🎯 核心功能

- **📸 设计稿上传** - 支持多种图片格式，自动压缩优化
- **🎨 实时预览** - 透明度调节，位置精确控制
- **🖱️ 拖拽定位** - 直观的元素拖拽，获取精确位置代码
- **⚙️ 代码模板** - 自定义代码输出格式，满足不同项目需求
- **💾 本地存储** - 数据安全存储，多页面同步
- **🌐 广泛兼容** - 支持所有HTTP/HTTPS网站，包括本地开发环境
- **🔒 安全保障** - 企业级安全防护，无数据泄露风险

## 🚀 快速开始

### 方式一：Chrome 应用商店安装

1. 打开 [**Chrome 应用商店页面**](https://chromewebstore.google.com/detail/draftpaper/pjaiiaekjjpapkjphhabicdjpblmlbdd)
2. 点击 `添加至 Chrome` 按钮
3. 确认安装权限
4. 刷新目标页面，点击扩展图标开始使用

### 方式二：本地开发安装

```bash
# 克隆项目
git clone https://github.com/dafengxiang/DraftPaper.git
cd DraftPaper

# 安装依赖 (推荐使用 pnpm)
pnpm install

# 构建项目
pnpm run build

# 在 Chrome 中加载扩展
# 1. 打开 chrome://extensions/
# 2. 开启"开发者模式"  
# 3. 点击"加载已解压的扩展程序"
# 4. 选择项目 build 文件夹
```

## 📖 使用指南

### 1. 底稿管理

<img src="./src/icons/add.png" width="16" style="vertical-align: middle;"> **添加底稿**
- 点击 `+` 按钮上传设计稿图片
- 支持 JPG、PNG、GIF、WebP 格式
- 自动压缩，最大支持 5MB

**调整参数**
- `width`: 设计稿原始宽度
- `top/left`: 图片位置偏移  
- `opacity`: 透明度调节（0-100%）

### 2. 元素定位

<img src="./src/icons/pick.png" width="16" style="vertical-align: middle;"> **拖拽模式**
- 点击拖拽图标启用/关闭拖拽模式
- 绿色图标表示拖拽模式已激活
- 点击页面元素开始拖拽
- 拖拽结束自动复制位置代码到剪贴板

### 3. 代码模板

<img src="./src/icons/setting.png" width="16" style="vertical-align: middle;"> **自定义模板**
- 点击设置图标进入模板配置
- 使用 `{top}` 和 `{left}` 作为位置占位符
- 支持任意 CSS 代码格式
- 实时预览生成效果

**默认模板示例**:
```css
position: absolute; top: {top}px; left: {left}px;
```

**自定义模板示例**:
```css
transform: translate({left}px, {top}px);
margin-top: {top}px; margin-left: {left}px;
```

## 🛠️ 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Webpack 5 + Less
- **代码规范**: ESLint + Prettier  
- **存储方案**: IndexedDB
- **安全防护**: DOMPurify + CSP
- **扩展标准**: Chrome Extension Manifest V3

## 🔒 安全特性

- ✅ **XSS 防护** - DOMPurify 清理用户输入
- ✅ **代码注入防护** - 模板代码严格验证
- ✅ **最小权限原则** - 支持所有HTTP/HTTPS网站运行
- ✅ **内容安全策略** - 防止恶意脚本执行
- ✅ **文件类型验证** - 严格的图片格式检查

## 📊 浏览器兼容性

### 浏览器支持

| 浏览器 | 版本要求 | 支持状态 |
|--------|----------|----------|
| Chrome | >= 88 | ✅ 完全支持 |
| Edge | >= 88 | ✅ 完全支持 |
| Firefox | 计划中 | 🔄 开发中 |
| Safari | 计划中 | 🔄 开发中 |

### 网站兼容性

- ✅ **HTTPS 网站** - 所有生产环境网站
- ✅ **HTTP 网站** - 内网和老旧网站  
- ✅ **本地开发** - localhost、127.0.0.1等
- ✅ **内网环境** - 192.168.x.x、10.x.x.x等
- ❌ **浏览器内置页面** - chrome://、edge://等系统页面

## 🤝 贡献指南

我们欢迎任何形式的贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详细信息。

### 开发环境要求

- Node.js >= 16.0.0
- pnpm >= 8.0.0

### 本地开发

```bash
# 开发模式（监听文件变化）
pnpm run dev

# 类型检查
pnpm run type-check

# 代码检查
pnpm run lint

# 代码格式化
pnpm run format
```

## 📋 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新详情。

### 最新更新 v0.2.1

- 🌐 **兼容性提升** - 支持所有HTTP/HTTPS网站，包括本地开发环境
- 🔧 **配置优化** - 简化manifest权限配置，提升扩展加载稳定性
- 🎨 **样式修复** - 修复popup页面样式丢失问题

### v0.2.0

- 🚀 **TypeScript 重构** - 完整的类型安全支持
- 🔒 **安全性增强** - 修复 XSS 和代码注入漏洞  
- ⚡ **性能优化** - 防抖处理、内存管理、图片压缩
- 🎨 **UI 升级** - 现代化界面设计和用户体验
- 📚 **文档完善** - 详细的开发文档和使用指南

## 📞 问题反馈

- 📧 **邮箱**: [jiyuexuanzhuren@sina.com](mailto:jiyuexuanzhuren@sina.com)
- 🐛 **Bug 反馈**: [GitHub Issues](https://github.com/dafengxiang/DraftPaper/issues)
- 💡 **功能建议**: [GitHub Discussions](https://github.com/dafengxiang/DraftPaper/discussions)

## 📄 开源协议

本项目采用 [MIT](LICENSE) 开源协议。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者们！

---

<div align="center">

**如果这个项目对您有帮助，请给我们一个 ⭐ Star！**

Made with ❤️ by [wangfengxiang](https://github.com/dafengxiang)

</div>
