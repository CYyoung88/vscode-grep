# 如何在 Cursor 中开发和测试插件

## 方法一：开发模式运行（推荐）

这是开发和测试插件最常用的方式：

1. **打开插件目录**
   - 在 Cursor 中，选择 `File` > `Open Folder...`
   - 导航到 `vscode-grep` 目录并打开

2. **安装依赖**
   ```bash
   npm install
   ```
   这将会安装 TypeScript 和其他开发依赖

3. **编译代码**
   ```bash
   npm run compile
   ```
   或者使用监听模式（代码更改时自动编译）：
   ```bash
   npm run watch
   ```

4. **启动扩展开发宿主**
   - 按 `F5` 键，或者
   - 点击左侧活动栏的 "Run and Debug" 图标
   - 选择 "Run Extension" 配置（如果没有，VS Code 会自动创建）
   
   这将打开一个新的 "Extension Development Host" 窗口

5. **测试插件**
   - 在新打开的窗口中，打开任意文件
   - 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
   - 输入 "Grep" 并选择命令
   - 输入搜索模式和参数进行测试

6. **调试**
   - 在源代码中设置断点
   - 在开发窗口中测试时，断点会在主窗口中触发

## 方法二：打包安装（用于分发）

如果你想将插件打包成 .vsix 文件并安装：

1. **安装 vsce（VS Code Extension Manager）**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **打包插件**
   ```bash
   cd vscode-grep
   vsce package
   ```
   这将生成一个 `.vsix` 文件

3. **安装插件**
   - 在 Cursor 中，按 `Ctrl+Shift+P`
   - 输入 "Extensions: Install from VSIX..."
   - 选择生成的 `.vsix` 文件

## 方法三：发布到 VS Code 扩展商店

如果你想将插件发布到 VS Code 扩展市场：

### 准备工作

1. **创建发布者账号**
   - 访问：https://marketplace.visualstudio.com/manage/publishers
   - 使用 Microsoft 账号登录
   - 创建发布者（Publisher），名称将作为 `package.json` 中的 `publisher` 字段

2. **生成 Personal Access Token (PAT)**
   - 访问：https://dev.azure.com
   - 点击右上角用户图标 → Personal access tokens
   - 创建新 Token：
     - Name: 例如 "VS Code Extension Publishing"
     - Organization: 选择 "All accessible organizations"
     - Expiration: 设置过期时间
     - Scopes: 勾选 "Marketplace (Publish)"

3. **确保 package.json 配置完整**
   - `publisher`: 发布者名称（必需）
   - `license`: 许可证（必需）
   - `repository`: 代码仓库地址（推荐）
   - `icon`: 图标文件路径（推荐，128x128 PNG）

### 发布步骤

1. **登录发布者账号**
   ```bash
   vsce login <你的发布者名称>
   ```
   或者使用 PAT 直接发布：
   ```bash
   vsce publish -p <你的Personal Access Token>
   ```

2. **发布扩展**
   ```bash
   vsce publish
   ```
   这将自动：
   - 运行 `vscode:prepublish` 脚本编译代码
   - 验证扩展配置
   - 上传到扩展市场

3. **更新扩展**
   - 修改 `package.json` 中的 `version` 字段（必须递增）
   - 再次运行 `vsce publish`

### 注意事项

- 版本号必须遵循语义化版本（如 0.0.1 → 0.0.2）
- 确保扩展已充分测试
- README.md 会显示在扩展商店页面
- 首次发布后，扩展会在几分钟内出现在商店中

## 开发提示

- 修改代码后，需要重新编译（`npm run compile`）
- 如果使用 `npm run watch`，代码会自动编译
- 每次测试时，按 `F5` 启动新的开发宿主窗口
- 查看输出面板中的调试信息来排查问题

## 项目结构

```
vscode-grep/
├── src/
│   └── extension.ts      # 主扩展代码
├── syntaxes/
│   └── grep-result.tmLanguage.json  # 语法高亮定义
├── package.json          # 插件配置
├── tsconfig.json         # TypeScript 配置
└── README.md            # 插件说明
```
