# 贡献指南

感谢您对 DraftPaper 项目的关注！我们欢迎任何形式的贡献。

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- pnpm >= 8.0.0 (推荐使用 pnpm)

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/dafengxiang/DraftPaper.git
cd DraftPaper
```

2. **安装依赖**
```bash
pnpm install
```

3. **开发模式**
```bash
pnpm run dev
```

4. **构建项目**
```bash
pnpm run build
```

5. **代码检查**
```bash
# 运行 ESLint
pnpm run lint

# 自动修复代码格式
pnpm run lint:fix

# 格式化代码
pnpm run format

# TypeScript 类型检查
pnpm run type-check
```

### Chrome 扩展调试

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `build` 文件夹

## 📁 项目结构

```
DraftPaper/
├── public/                 # 静态资源
│   ├── icons/             # 扩展图标
│   └── manifest.json      # 扩展配置
├── src/                   # 源代码
│   ├── background.ts      # 后台脚本
│   ├── contentScript.ts   # 内容脚本
│   ├── popup.ts          # 弹窗入口
│   ├── config/           # 配置文件
│   ├── hooks/            # Vue Hooks
│   ├── types/            # TypeScript 类型定义
│   ├── utils/            # 工具函数
│   └── views/            # Vue 组件
├── config/               # 构建配置
└── docs/                # 文档
```

## 🔧 开发规范

### 代码风格

我们使用 ESLint + Prettier 来保证代码质量和统一的代码风格：

- **TypeScript**: 所有新代码必须使用 TypeScript
- **组件**: Vue 组件使用 `<script setup lang="ts">` 语法
- **命名**: 使用 camelCase 命名变量和函数，PascalCase 命名组件
- **注释**: 重要函数需要 JSDoc 注释

### 提交规范

我们遵循 [Conventional Commits](https://conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**类型（type）**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 添加测试
- `chore`: 构建工具或辅助工具的变动

**示例**:
```bash
feat(content-script): 添加元素拖拽防抖功能
fix(security): 修复图片 URL XSS 安全漏洞
docs(readme): 更新安装说明
```

### 分支策略

- `master`: 主分支，保持稳定
- `develop`: 开发分支
- `feature/*`: 功能分支
- `fix/*`: 修复分支

## 🐛 报告问题

在提交 Issue 前，请确保：

1. 搜索现有 Issues，避免重复
2. 提供详细的问题描述
3. 包含复现步骤
4. 提供环境信息（浏览器版本、操作系统等）

### Issue 模板

```markdown
## 问题描述
简要描述遇到的问题

## 复现步骤
1. 打开扩展
2. 执行某个操作
3. 观察结果

## 期望行为
描述期望的正确行为

## 实际行为
描述实际发生的行为

## 环境信息
- 浏览器: Chrome 120.0.0.0
- 操作系统: macOS 14.0
- 扩展版本: 0.2.0
```

## ✨ 提交代码

### Pull Request 流程

1. **Fork 项目**
2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **开发并提交**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   ```

4. **推送到远程**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**

### PR 检查清单

- [ ] 代码通过 ESLint 检查
- [ ] TypeScript 类型检查通过
- [ ] 功能测试完成
- [ ] 添加必要的注释
- [ ] 更新相关文档
- [ ] PR 描述清晰

## 🔒 安全相关

如果发现安全漏洞，请**不要**公开提交 Issue，而是发送邮件到：
- 邮箱：jiyuexuanzhuren@sina.com

我们会尽快回复并处理安全问题。

## 📝 文档贡献

我们同样欢迎文档方面的贡献：

- 修复文档错误
- 改进文档结构
- 翻译文档
- 添加使用示例

## 🎯 开发重点

当前项目的开发重点：

1. **安全性**: 持续改进安全防护
2. **性能**: 优化扩展性能
3. **用户体验**: 改善界面和交互
4. **兼容性**: 支持更多浏览器
5. **测试**: 添加自动化测试

## 🤝 社区

- GitHub Issues: 技术讨论和问题反馈
- Email: jiyuexuanzhuren@sina.com

感谢您的贡献！🎉