# 🎨 LLM-HTML 渲染引擎：组件设计规格文档

## 一、全局规则

1.  **输出协议**：LLM 必须输出包含 `<!doctype html>` 的完整 HTML 结构，前端据此判断采用 iframe 渲染。
2.  **样式隔离**：前端通过将注入 iframe，并全局引入预设 CSS 和交互 JS。
3.  **样式限制**：不建议 LLM 内联 style 或 css，严禁 LLM 生成 js 代码（前端二次筛除）。所有样式应当尽量通过预设类名实现。
4.  **原生优先**：对于基础排版（标题、段落、列表、加粗、代码块），LLM 使用标准 HTML 标签即可，前端全局样式会接管美化。

## 二、组件规范

### 1. 提示框
用于重要信息的强调、警告或提示补充。
*   **结构**：`<div class="note-{type}">内容</div>`
*   **类型**：
    *   `note-info`：蓝色，一般提示
    *   `note-success`：绿色，成功/正确做法
    *   `note-warning`：黄色，警告/注意
    *   `note-danger`：红色，错误/危险
*   **LLM 示例**：
    ```html
    <div class="note-warning">此操作会导致数据清空，请谨慎执行。</div>
    ```

### 2. 折叠框
用于收纳冗长的补充说明或大段代码，保持界面清爽。利用 HTML 原生标签实现无 JS 交互。
*   **结构**：`<details class="collapse"><summary>标题</summary>内容</details>`
*   **LLM 示例**：
    ```html
    <details class="collapse">
      <summary>点击查看完整配置文件</summary>
      <pre><code class="language-json">{ ... }</code></pre>
    </details>
    ```

### 3. 标签页
用于对比不同方案、多语言代码或横向信息展示。需前端 JS 辅助切换。
*   **结构**：
    ```html
    <div class="tabs">
      <div class="tab" data-label="标签1名称">内容1</div>
      <div class="tab" data-label="标签2名称">内容2</div>
    </div>
    ```
*   **LLM 示例**：
    ```html
    <div class="tabs">
      <div class="tab" data-label="JavaScript">console.log('Hello');</div>
      <div class="tab" data-label="Python">print('Hello')</div>
    </div>
    ```

### 4. 分栏
用于左右/多列排版。基于 CSS Grid 实现，数字代表所占的 `fr` 比例。
*   **结构**：
    ```html
    <div class="col-con">
      <div class="col-{n}">左列内容</div>
      <div class="col-{m}">右列内容</div>
    </div>
    ```
*   **规则**：`n` 和 `m` 为整数，表示 Grid 的 `fr` 比例。如 `col-1 col-2` 表示 1:2 宽度。
*   **LLM 示例**：
    ```html
    <div class="col-con">
      <div class="col-1">概念解释：这是关于...</div>
      <div class="col-1">代码示例：<pre><code>...</code></pre></div>
    </div>
    ```

<!-- ### 5. 图表
可能需要引入外部库，先暂时不做
用于数据可视化。采用极简数据注入，避免 LLM 输出复杂的图表配置。
*   **结构**：`<div class="chart-{type}" data-src='{JSON}'></div>`
*   **类型**：`chart-bar`, `chart-line`, `chart-pie`
*   **数据格式**：`data-src` 接收 JSON 字符串，包含 `labels` (数组) 和 `values` (数组/二维数组)。
*   **LLM 示例**：
    ```html
    <div class="chart-bar" data-src='{"labels":["Q1","Q2","Q3"], "values":[120,200,150]}'></div>
    ``` -->

### 6. 步骤条
用于流程讲解、操作步骤。\
整体一列排布，每步前加一个 checkbox，完成后本步内容删除线并变灰。
*   **结构**：
    ```html
    <div class="steps">
      <div class="step">步骤1内容</div>
      <div class="step">步骤2内容</div>
    </div>
    ```
*   **LLM 示例**：
    ```html
    <div class="steps">
      <div class="step">安装依赖：npm install</div>
      <div class="step">启动服务：npm start</div>
    </div>
    ```

### 7. 行内标签
用于行内高亮关键词。
*   **类型**：
    *   字体颜色类
        *   `tag-blue`：蓝色
        *   `tag-green`：绿色
        *   `tag-yellow`：黄色
        *   `tag-red`：红色
        *   ...
    *   背景颜色类
        *   `tag-bg-blue`: 蓝色
        *   ...

*   **结构**：`<span class="tag-blue">关键词</span>`
*   **LLM 示例**：
    ```html
    <p>在 Vue 中，推荐使用 <span class="tag-blue">ref</span> 来定义响应式基础类型。</p>
    ```

## 三、代码结构规范
考虑将当前工具区下的 ./packages/llm-html 单独发包为 @woisol-g/llm-html，内部包含上述组件的 CSS 样式以及必要的 js 逻辑，以及提供给 llm 的模板使用说明 prompt。具体调用时将 CSS 和 JS 动态注入到 iframe 中，LLM 只需输出符合规范的 HTML 即可。

