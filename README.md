# ⚡ Prompt 库

个人 Prompt 收藏管理器 —— 纯静态单页应用，数据直接存在本仓库的 `prompts.json`，通过 GitHub Contents API 读写。

**在线使用**：<https://eastseao.github.io/prompt/>

## 架构

- 纯静态页面（`index.html` 单文件，无构建、无后端），托管于 GitHub Pages
- 数据文件：[`prompts.json`](prompts.json)（每次增删改自动生成一条 commit，历史可追溯）
- 读取：公开 API 免认证
- 写入：浏览器本地保存的 GitHub Fine-grained Token（仅限本仓库 Contents 读写权限），首次使用点页面右上角 ⚙️ 配置

## 功能

- 添加 / 编辑 / 删除 Prompt
- 搜索（标题 / 内容 / 标签）、分类筛选、标签
- 收藏 ⭐、排序（最新 / 最早 / 标题 / 收藏优先）
- 一键复制、Ctrl+K 快捷搜索、Ctrl+Enter 快速保存
- 移动端自适应

## 本地文件说明

- `index.html` — 站点页面（GitHub Pages 入口）
- `prompts.json` — 全部 Prompt 数据
