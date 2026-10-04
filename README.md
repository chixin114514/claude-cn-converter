# Claude CN Converter

一个仅在 `claude.ai` 生效的 Tampermonkey Userscript。

## 功能

- 在 Claude 输入框按 **Enter** 发送时，将简体中文转换为台湾繁体并再发送。
- Claude 回复在页面显示时，自动转换为大陆简体中文。
- `Shift + Enter` 保持正常换行。
- 中文输入法（IME）正在选字时，不拦截 Enter。
- 默认跳过 `code`、`pre`、输入框、脚本和样式节点，避免修改代码内容。
- 支持 Claude 的流式回复，通过 `MutationObserver` 持续转换新增文本。
- 使用 OpenCC.js 的词汇级转换：
  - 发送：`cn -> twp`
  - 显示：`twp -> cn`

## 安装

1. 浏览器安装 Tampermonkey。
2. 打开下面的 Userscript 原始文件：
   https://raw.githubusercontent.com/chixin114514/claude-cn-converter/main/claude-cn-converter.user.js
3. Tampermonkey 会弹出安装页面，点击“安装”。
4. 刷新 https://claude.ai/ 。

## 行为示例

你输入：

```text
帮我检查这个软件有没有问题。
```

按 Enter 后，发送给 Claude 的文本会转换为台湾繁体，例如：

```text
幫我檢查這個軟體有沒有問題。
```

Claude 的繁体回复会在浏览器页面中重新显示为简体中文。

## 注意

脚本只修改浏览器页面中的输入和显示文本，不会修改 Claude 服务端保存的回复内容。

Claude 的前端 DOM 结构可能随网站更新变化。如果转换突然失效，通常需要调整消息区域或发送按钮的选择器。

## License

MIT
