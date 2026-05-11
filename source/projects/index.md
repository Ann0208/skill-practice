---
title: Projects
date: 2026-05-11 10:00:00
type: "projects"
layout: "page"
---

<style>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin: 24px 0;
}
.project-card {
  border: 1px solid var(--card-border, #e8e8e8);
  border-radius: 12px;
  padding: 24px;
  background: var(--card-bg, #fff);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}
.project-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.2em;
}
.project-card .project-desc {
  color: var(--text-color-secondary, #666);
  font-size: 0.9em;
  line-height: 1.6;
  margin-bottom: 16px;
}
.project-card .tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.project-card .tech-tag {
  background: var(--tag-bg, #f0f0f0);
  color: var(--tag-color, #555);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75em;
}
.project-card .project-metrics {
  display: flex;
  gap: 16px;
  font-size: 0.8em;
  color: var(--text-color-secondary, #888);
  border-top: 1px solid var(--card-border, #eee);
  padding-top: 12px;
}
.project-card .metric-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.project-role {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75em;
  margin-bottom: 12px;
}
</style>

<div class="project-grid">

<div class="project-card">
  <span class="project-role">核心开发者</span>
  <h3>Canvas 可视化编辑器</h3>
  <p class="project-desc">
    基于 Canvas 2D 的低代码可视化编辑器，支持流程图、数据可视化、自由画布等场景。实现了分层渲染引擎、插件化架构、实时协作编辑等核心能力。
  </p>
  <div class="tech-stack">
    <span class="tech-tag">Canvas 2D</span>
    <span class="tech-tag">React</span>
    <span class="tech-tag">TypeScript</span>
    <span class="tech-tag">WebSocket</span>
    <span class="tech-tag">CRDT</span>
    <span class="tech-tag">Web Worker</span>
  </div>
  <div class="project-metrics">
    <span class="metric-item">📊 2400+ Commits</span>
    <span class="metric-item">⚡ 渲染性能提升 300%</span>
  </div>
</div>

<div class="project-card">
  <span class="project-role">技术负责人</span>
  <h3>TAPD AI 智能助手</h3>
  <p class="project-desc">
    基于 LLM 的项目管理智能助手，集成 TAPD 平台实现需求拆解、缺陷分析、迭代总结等功能。采用 Agent 架构，支持多轮对话和工具调用。
  </p>
  <div class="tech-stack">
    <span class="tech-tag">LangChain</span>
    <span class="tech-tag">GPT-4</span>
    <span class="tech-tag">Python</span>
    <span class="tech-tag">FastAPI</span>
    <span class="tech-tag">RAG</span>
    <span class="tech-tag">FAISS</span>
  </div>
  <div class="project-metrics">
    <span class="metric-item">🚀 效率提升 40%</span>
    <span class="metric-item">👥 服务 200+ 用户</span>
  </div>
</div>

<div class="project-card">
  <span class="project-role">独立开发</span>
  <h3>AI 视觉创作平台</h3>
  <p class="project-desc">
    结合 AI 图像生成与 Canvas 编辑能力的创作平台，支持文生图、图生图、智能抠图、风格迁移等功能，提供所见即所得的编辑体验。
  </p>
  <div class="tech-stack">
    <span class="tech-tag">Stable Diffusion</span>
    <span class="tech-tag">Canvas</span>
    <span class="tech-tag">React</span>
    <span class="tech-tag">Node.js</span>
    <span class="tech-tag">WebSocket</span>
  </div>
  <div class="project-metrics">
    <span class="metric-item">🎨 支持 10+ AI 模型</span>
    <span class="metric-item">📈 日均生成 500+ 图</span>
  </div>
</div>

<div class="project-card">
  <span class="project-role">核心开发者</span>
  <h3>SVG to HTML 工具集</h3>
  <p class="project-desc">
    设计稿到前端代码的自动化转换工具，支持 SVG/Figma 设计稿解析，智能生成语义化 HTML + CSS 代码，大幅提升设计还原效率。
  </p>
  <div class="tech-stack">
    <span class="tech-tag">SVG Parser</span>
    <span class="tech-tag">AST</span>
    <span class="tech-tag">TypeScript</span>
    <span class="tech-tag">Figma API</span>
    <span class="tech-tag">PostCSS</span>
  </div>
  <div class="project-metrics">
    <span class="metric-item">⏱️ 还原效率提升 60%</span>
    <span class="metric-item">🎯 代码准确率 95%</span>
  </div>
</div>

<div class="project-card">
  <span class="project-role">独立开发</span>
  <h3>Code Review AI Agent</h3>
  <p class="project-desc">
    基于 LLM 的智能代码审查工具，集成 Git 工作流，自动分析代码变更、识别潜在问题、提供优化建议，支持自定义审查规则。
  </p>
  <div class="tech-stack">
    <span class="tech-tag">Claude API</span>
    <span class="tech-tag">Git Hooks</span>
    <span class="tech-tag">TypeScript</span>
    <span class="tech-tag">AST Analysis</span>
    <span class="tech-tag">MCP</span>
  </div>
  <div class="project-metrics">
    <span class="metric-item">🔍 覆盖 5 种语言</span>
    <span class="metric-item">🐛 问题检出率 85%</span>
  </div>
</div>

<div class="project-card">
  <span class="project-role">独立开发</span>
  <h3>Skill Practice 技术博客</h3>
  <p class="project-desc">
    基于 Hexo + Butterfly 的个人技术博客，涵盖前端技术、AI 实践、性能优化等方向。配置了 CI/CD 自动部署、本地搜索、阅读统计等功能。
  </p>
  <div class="tech-stack">
    <span class="tech-tag">Hexo</span>
    <span class="tech-tag">Butterfly</span>
    <span class="tech-tag">GitHub Actions</span>
    <span class="tech-tag">Service Worker</span>
    <span class="tech-tag">Pug</span>
  </div>
  <div class="project-metrics">
    <span class="metric-item">📝 49 篇技术文章</span>
    <span class="metric-item">🏷️ 10+ 技术分类</span>
  </div>
</div>

</div>
