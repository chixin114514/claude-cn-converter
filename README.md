# Claude CN Converter

让你在 Claude 中继续使用大陆简体中文，但实际发送给 Claude 的中文自动转换为台湾繁体，并把 Claude 的繁体回复重新显示成大陆简体。

本仓库提供两个版本：

- **Claude Code Plugin / Mod**：用于 Claude Code 终端。
- **Tampermonkey Userscript**：用于 `claude.ai` 网页版。

转换逻辑基于 OpenCC：

- 网页版使用 [opencc-js](https://github.com/nk2028/opencc-js)。
- Claude Code Mod 由于运行在无 Node.js、无网络的隔离环境中，内置 [opencc-data](https://github.com/nk2028/opencc-data) 词典并使用本地 Trie 转换器，不依赖 `node_modules`。
- 发送：大陆简体 → 台湾繁体，并转换台湾常用词汇。
- 显示：台湾繁体及词汇 → 大陆简体。

---

## Claude Code 插件

### 功能

Claude Code 版本使用 Function Hooks / Mods：

1. 你在输入框里输入简体中文。
2. `prompt.submit` 在真正提交之前自动转换成台湾繁体。
3. Claude 实际收到的是转换后的繁体 prompt。
4. `ui.render` 在终端渲染 Claude 回复时自动转换回简体。
5. 用户消息在终端里也重新显示为简体，所以正常使用时基本感觉不到转换过程。

同时会保护：

- Markdown fenced code blocks，例如 ```python ... ```
- 行内代码，例如 `git status`
- 命令、路径和代码标识符不会因为中文转换被意外修改

### 要求

Claude Code Function Hooks 目前需要显式启用。

建议使用 Claude Code **2.1.269 或更新版本**：

```bash
claude --version
```

在 `~/.claude/settings.json` 中加入：

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
  }
}
```

如果你的 `settings.json` 已经有其他设置，只需要把 `env` 字段合并进去，不要覆盖原文件。

也可以仅为当前终端会话启用：

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

PowerShell：

```powershell
$env:CLAUDE_CODE_ENABLE_FUNCTION_HOOKS = "1"
claude
```

### 安装

把本仓库加入 Claude Code marketplace：

```bash
claude plugin marketplace add chixin114514/claude-cn-converter
```

安装插件：

```bash
claude plugin install cn-converter@chixin-plugins
```

然后重新启动 Claude Code，或者在已有会话中运行：

```text
/reload-plugins
```

安装完成后无需额外命令，转换会自动生效。

插件提供本地自检命令：

```text
/cn-converter
```

正常情况下会看到类似：

```text
Claude CN Converter 1.0.2 loaded
S → TW: 憂鬱的烏龜；軟體；網路連線；程式碼
TW → S: 忧郁的乌龟；软件；网络连接；代码
```

这个命令完全在插件本地执行，不经过 Claude 模型，因此比让模型“逐字复述”更适合判断插件是否真正加载。

### 更新已安装插件

如果你已经安装过旧版，先刷新 marketplace，再更新插件：

```bash
claude plugin marketplace update chixin-plugins
claude plugin update cn-converter@chixin-plugins
```

然后重新启动 Claude Code，或在当前会话执行：

```text
/reload-plugins
```

也可以在 Claude Code 会话内执行：

```text
/plugin marketplace add chixin114514/claude-cn-converter
/plugin install cn-converter@chixin-plugins
```

### 本地开发测试

克隆仓库后，可以跳过 marketplace，直接加载插件：

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 \
claude --plugin-dir ./plugins/cn-converter
```

可以先让 Claude Code 校验插件结构：

```bash
claude plugin validate ./plugins/cn-converter
```

### Claude Code 插件结构

```text
.claude-plugin/
└── marketplace.json

plugins/
└── cn-converter/
    ├── .claude-plugin/
    │   └── plugin.json
    ├── hooks/
    │   ├── hooks.json
    │   ├── register.ts
    │   ├── opencc.ts
    │   ├── opencc-s2t-data.ts
    │   └── opencc-t2s-data.ts
    ├── LICENSES/
    │   └── Apache-2.0.txt
    └── THIRD_PARTY_NOTICES.md
```

Claude Code 版本不依赖 npm 包；转换代码和 OpenCC 词典都随插件一起加载。

### 一个例子

你输入：

```text
帮我检查这个软件有没有问题。
```

真正提交给 Claude 的内容会转换为：

```text
幫我檢查這個軟體有沒有問題。
```

如果 Claude 回复：

```text
這個軟體目前有三個問題。
```

终端中会显示为：

```text
这个软件目前有三个问题。
```

> 回复转换属于 UI 渲染转换。插件改变的是你在终端中看到的文本，不会重新改写 Claude 已经生成的底层消息记录。

---

## claude.ai / Tampermonkey 版本

网页版脚本位于：

```text
claude-cn-converter.user.js
```

### 功能

- 在 Claude 输入框按 **Enter** 发送时，将简体中文转换为台湾繁体再发送。
- Claude 回复在页面显示时，自动转换为大陆简体中文。
- `Shift + Enter` 保持正常换行。
- 中文输入法（IME）正在选字时，不拦截 Enter。
- 跳过 `code`、`pre`、输入框、脚本和样式节点。
- 支持 Claude 流式回复。
- 仅匹配 `https://claude.ai/*`。

### 安装

1. 浏览器安装 Tampermonkey。
2. 打开 Userscript：
   https://raw.githubusercontent.com/chixin114514/claude-cn-converter/main/claude-cn-converter.user.js
3. Tampermonkey 弹出安装页面后点击“安装”。
4. 刷新 https://claude.ai/ 。

---

## License

本项目自有代码使用 MIT License。

Claude Code 插件内置的 OpenCC 词典数据来自 `nk2028/opencc-data` / `BYVoid/OpenCC`，按 Apache License 2.0 使用，详见 `plugins/cn-converter/THIRD_PARTY_NOTICES.md`。
