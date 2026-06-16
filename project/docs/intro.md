# 注意仍有几个 TODO 需要填充 #
我需要给我的项目准备讲解文稿，现在在简历项目经历上写了下面的文案：

```
"yaCA / yaCA-Web",
"全栈开发",
"https://github.com/Woisol/yaCA | https://github.com/Woisol/yaCA-Web",
timeRange("2026.05.04", "2026.05.13"),
简介："一个终端 Coding Agent Cli，旨在为低价小模型提供更稳定的工具调用。支持通过 yaCA-Web 拓展启动 Web 界面，在 Web 界面下模型默认输出更高信息密度与组织程度的 HTML 模板消息。",
技术："Agent Harness、React、Ink.js、Vite+、Assistant-UI、React Syntax Highlighter、Monorepo、Husky、GitHub Actions",
工作："使用 Monorepo 划分整体架构为七部分，实现会话管理与持久化，同时支持原生 FC 与小模型兼容的流式 XML 解析 FC，基于预置类名与 Iframe 的安全流式 HTML 渲染，Cli 与 Web 分包发布按需安装，对语法高亮库的代码分隔懒加载，GitHub Actions CI/CD 自动发布到 npm 仓库。",
成果："项目在 9 天内从无到完善，对小模型的 XML 工具解析成功率约从无错误兜底的 20% 升至完全可用的 90%，默认 HTML 的输出策略带来比原生 Markdown 高约 30%-50% 的信息密度与组织程度，基于 React.lazy 与 Suspend 的代码分隔优化提高了约 60% FCP，项目已用于日常开发并提高了数个项目的开发效率。",
```

我初步拟了下面的文稿，请你以大厂面试官严苛的标准进行审阅，指出不合理的表述和可以润色的句子（但保留我的文章风格）：

---
# yaCA 介绍文稿

## 介绍

yaCA 是我从零实现的一套本地 Coding Agent 工具链，首先它明确分为两部分，一部分是 yaCA Cli 终端应用，核心价值是解决一些低价小模型无法使用工具的问题，主推特性在 XML 风格的工具调用兼容方案；另一部分是 yaCA-Web Web UI，核心价值在于对模型输出内容的优化探索，主推 HTML-first 的模型输出方案，验证了模型优先输出 HTML 这一方案的可行性和实用性。在开发完成后我和 yaCA 一同参与了多个个人项目，以极低的成本较好地支持了项目审查的需求。

## 背景与动机

做这个项目最直接的原因，是我自己正在使用的免费小模型不支持原生的工具调用，需要把工具调用约束成纯文本的调用格式，再适当做一些兜底处理提高解析成功率。把“模型能力不稳定”的问题尽量转化为“客户端协议和解析器可控”的工程问题。同时小模型极其有限的上下文窗口也迫切需要 subagent 功能，让主 Agent 作为 Orchestrator 将复杂任务拆分给多个 subagent 处理。\
然后做 HTML-first 则是受推特等社区的启发。我在使用 ChatGPT 等产品时也发现，默认输出 Markdown 的模型信息密度有限，因此希望验证：如果让模型优先输出 HTML，并通过预置类名 + 安全渲染，是否能在不显著增加模型负担的前提下，提升输出信息密度与可交互性。

## 技术架构与选型

yaCA 使用 Monorepo 结构，将代码拆分组织为 cli、web、agent-core、agent-tools、shared/ui、shared/types、utils 七个子包，统一管理依赖与构建。其中 cli 和 web 主要处理前端交互与 AgentLoop 调用，agent-core 和 agent-tools 分别实现 AgentLoop 核心逻辑和具体工具；shared 下放置跨端复用的类型、UI 工具和通用逻辑。构建工具使用 tsup，测试基于 Node 内置 test runner + tsx。

1. 由于一开始就计划 Cli 和 Web 分包发布共享逻辑，因此很自然地选择了 Monorepo 的项目结构。同时由于核心 AgentLoop、工具、会话、权限、消息渲染等逻辑需要在双端复用，将它们拆分下沉到核心包，而 Cli 和 Web 只作为不同的 presentation layer，更利于项目后续的开发维护。
2. 项目整体采用 React 技术栈，cli 使用 Ink.js 实现终端交互，web 则是 Vite plus 构建的 React Web 应用。简单的 `readline` 和 `stdout.write` 难以实现复杂的交互需求且需要大量精力维护，而相比 Vue，React 生态有更成熟的终端 UI 方案 Ink.js，让项目更聚焦于核心功能，也能和 Web 端的 React 心智保持一致，减少维护成本。
3. 组件库使用了 Assistant UI，在于其专门为大模型应用设计的组件能够较好地满足项目需求
4. 项目的日志需求集中在本地调试，没有复杂的采集、传输和查询需求，所以只做了基于 console 的轻量 Logger 包装。这样可以提供标签和日志级别，同时避免为了很小的需求引入 Pino 等完整日志框架。包装的实现借鉴参考了 Angular 的 Logger，提供了日志级别、模块名和样式等功能。
5. 路由系统同样由于需求简单（仅需要一个 /:sessionId 根级会话路由）使用了原生 History API 实现，而没有引入 React Router 等第三方库，减少了依赖和维护面。

项目不使用过多外部库的另一个考量是近期频发的 NPM 包投毒事件，保持依赖的最小化可以降低安全风险。

(不主动提)
> Q: 不过多使用外部库真不是因为都是 AI 写的吗？\
> A：还真不太正确，在写日志之前我确实调研选型过日志库，看过比如 Pino、Winston、tslog 等日志库，但最终觉得项目目前的日志需求比较简单，特别是前二者的结构化日志功能还是太重了自己也不算熟悉（诶这点是本质）；路由系统同样，React Router 我在之前的项目中也用过挺多，这次确实是考虑到仅一个根级路由的需求，使用原生 History API 反而更轻量直接。

## 项目亮点

### 1. 双模式工具调用：OpenAI 格式工具调用 + XML 兼容模式

yaCA 默认使用 OpenAI 格式的工具调用，也支持开启兼容模式，通过提示词要求模型输出 XML 风格的工具调用标签，由本地 streaming XML parser 流式解析。

<!-- glm：“高阶 Agent Harness”这个词有点自造 -->
### 2. Agent Harness + Subagent 编排模型

我提供了 Explore 和 Edit 两个 Subagent 分别负责读写代码。主 Agent 作为 Orchestrator，负责任务分发和结果回收。这样可以避免单 Agent 在长链路任务中因上下文过长而漂移，也让执行过程更可审计、更易扩展。

### 3. 本地工具注册与权限体系

项目提供文件读写、搜索、移动、删除、命令执行等本地工具。这里最重要的不是“能执行”，而是“可控地执行”。

工具体系分两层：

- `agent-tools` 的 `ToolRegistry` 负责工具注册、hint 生成和实际执行。
- `ToolPermissionController` 负责读写配置与热加载。

在 Trust 模式下，允许模型直接调用所有工具；而非 Trust 模式下，模型调用允许列表外的工具需要用户确认。

命令执行还单独检查命令的 allow-list，支持通配符。文件工具允许绝对路径，但删除工具默认拒绝删除 workspace 外部路径，只有显式传入危险参数才允许。

工具注册采用 factory 模式，将上下文 context 传递给工具工厂函数，生成工具定义和执行函数，再由 AgentLoop 注册到工具注册表

<!-- ### 4. 会话持久化、恢复和 rewind

会话以 workspace 为粒度，用 workspace 路径 hash 隔离不同项目。每个 session 有元数据和 JSONL 消息记录，支持：

- `/resume` 恢复指定会话；
- `/continue` 继续最近会话；
- `/rename` 重命名；
- `/delete` 软删除；
- `/clean` 清理已软删除目录；
- `/rewind` 到某条历史用户消息并恢复输入。 -->

<!-- 这里有一个细节：工具调用和工具结果也会作为结构化事件写进历史，而不是只写最终文本。这样恢复会话时能重建工具卡片，也能把历史转换回模型可理解的工具上下文。 -->

### 4. Web UI 的 HTML-first 安全渲染

yaCA-Web 主推 HTML-first 输出策略，让模型在适合结构化展示时输出特化的 HTML 文本：

```html
<body>
  <h2>Plan</h2>
  <div class="steps">
    <div class="step">Read context</div>
    <div class="step">Patch code</div>
    <div class="step">Run tests</div>
  </div>
</body>
```

为了降低模型负担 yaCA-Web 针对模型输出场景，预置了多个类名方便模型输出，例如 note-x、tag-x、collapse（基于 HTML5 detailed 标签）、tabs、column、step 等

渲染时，客户端不会直接把这段 HTML 塞进主页面，而是：

1. 基于 <body> 开头判断模型是否输出 HTML。
2. 创建稳定的 sandboxed iframe shell。
3. shell 内通过 CSP 禁止外部脚本和网络连接。
4. 对模型 HTML 做 sanitizer，移除 script/style/iframe/object、事件属性、不安全 URL 等。
5. 用 postMessage 跨域通讯把流式 payload 更新到 iframe，而不是每次重建 iframe。
6. 用 ResizeObserver 把 iframe 高度回传给父页面。

这样既避免直接使用 dangerouslySetInnerHTML 的 XSS 与样式污染风险，又避免每次流式更新 srcdoc 导致 irame 重建的灾难性闪烁与性能开销。

### 6. CLI/Web 分包发布与按需安装

yaCA 和 yaCA-Web 的分包发布实践，主包 `@woisol-g/yaca` 只提供 CLI 和共享 runtime；Web 包 `@woisol-g/yaca-web` 独立发布，并作为 peer dependency 依赖根包。CLI 中 `--serve` 使用动态 import 加载 Web server，根包构建时把 Web 包 external 掉。

这样用户只使用 CLI 时不需要安装 Web UI 的依赖；需要浏览器界面时再安装 Web 包。这个设计兼顾了包体积、依赖复杂度和功能扩展性。

## 项目难点

### 1. 双工具调用格式与 XML 流式解析

为提升交互体验，兼容模式的 XML 解析不是等模型整段输出完成后再解析，而是边接收 token 边交给 parser。`think` 标签在 open 时确认，方便 UI 尽早展示思考内容；`tool_call` 在 close 时确认，保证 JSON 参数完整后再执行工具。

如果 JSON 解析或者工具调用失败，AgentLoop 会把它转换成 failure 作为工具结果反馈给模型，让模型自我修正。AgentLoop 还维护连续工具失败次数，达到上限后终止本轮，避免模型和工具互相死循环。

对于流式 XML 解析，在没有额外兜底时，某些模型输出可解析工具调用的稳定性很差，时常出现标签不闭合或错误闭合的问题。通过添加宽容模式，在模型输出结束时尽可能 fallback 解析，比如只需要 </ 就能判断标签闭合，允许不匹配的闭合标签等，提高了工具解析的成功率，实际使用中已经能将低价模型工具调用的体感可用率，从偶发可用提升到多数可用。

另外一个小难点在于两种模式的历史消息格式不同，需要专门写一个 Map 函数。同时工具调用的结果使用 JSON 格式持久化，在返回给大模型时也需要一些 Map 转为大模型友好的纯文本。

### 2. React Syntax Highlighter 性能优化

React Syntax Highlighter 全量构建体积较大，对语法高亮完整支持的需求和显著增加包大小并拖慢首屏渲染的现状产生了矛盾。加之流式输出阶段代码内容频繁更新，不适合在模型输出时就加载高亮库。\
解决方案是，借助 React.lazy 和 Suspense 对高亮库做代码分隔，在流式阶段和完成流式还未导入完成之前，用 Suspense 的 fallback 先展示无高亮的代码块，动态导入完成后再切换渲染高亮版本。\
代码分隔优化后，FCP 从约 [TODO] ，显著提高了渲染性能。

### 3. Web HTML 流式渲染的安全和性能平衡

模型优先输出 HTML 很新颖也很有意义，但也存在 XSS、样式污染、脚本执行等安全问题。同时一开始的实现方案是直接动态更新 iframe 的 srcdoc，而这会导致 iframe 不断重建，造成闪烁和性能问题。\
解决方式是：主应用只负责创建一个稳定 iframe shell，模型输出作为 sanitized body payload 通过 postMessage 更新；shell 内只有我注入的 CSS 和 runtime script。代码高亮只在最终阶段动态加载，流式阶段保持轻量。

另外 iframe 的高度也需要动态更新，使用 ResizeObserver 监听 iframe 内容高度变化后同样通过 postMessage 回传给父页面调整 iframe 大小，保证了流式渲染的体验。


## AI 协作

yaCA 项目本身也是一次 AI 协作开发实践，在项目的开发中，我与 AI 高效协作，在 9 天内从零开始完成项目。在项目选型规划阶段，我与 glm 反复讨论项目的产品目标、技术选型与实施方案，以及接口定义、项目结构等，并最终产出项目实施文档；在实施阶段，我使用 GPT-5.5 high 在 Codex Cli 中进行协助开发。项目开发起始时，我使用 AI 快速搭建项目开发环境与脚手架，人工审查并调整项目结构后继续由我和 AI 同步进行功能开发，同时由我人工审查 AI 代码并实际进行黑盒测试。

<!-- - 我负责拆分模块、审查代码边界和决定哪些逻辑应该下沉到 shared/core。
- AI 负责加速样板代码、测试补齐、局部重构和重复性实现。
- 对高风险部分，比如工具权限、文件删除、HTML sanitizer、会话持久化，我会人工审查并跑测试。 -->
- 项目开发后期，我把一些维护知识整理为 Codex Skill，让后续 AI 维护项目时先理解项目结构和风险点，再动代码。

AI 提升了实现效率，但项目不是“让 AI 随便生成”，而是我通过架构拆分、测试和代码审查把 AI 当成工程加速器使用。

superpower
上下文管理


## 可能追问与参考回答

### Q1：原生 function calling 的原理是什么？为什么还要做 XML/SXML？

原生 function calling 本质上是模型服务端和模型对齐过的一套结构化输出协议。客户端把 tools schema 传给模型，模型返回 assistant message，其中包含 `tool_calls`，每个 tool call 有 name、arguments 和 id。客户端执行工具后，再用 `role: "tool"` 和对应 `tool_call_id` 把结果发回模型。

它的优势是结构稳定、生态统一、模型训练时通常专门对齐过；缺点是依赖模型和服务商实现，很多 OpenAI-compatible 中转或低价模型并不真正稳定支持。

XML/SXML 模式是退一步的兼容方案：不依赖服务端 tools 字段，而是通过 prompt 约束模型输出文本格式，再在客户端解析。它不如原生 FC 严谨，但好处是通用，只要模型能输出文本就能尝试使用工具。

### Q2：XML 工具调用为什么比原生 FC 更容易出错？

因为 XML/SXML 是 prompt-level 约束，不是模型服务端保证的结构化协议。模型可能忘记闭合标签、JSON 写错、混入自然语言、生成不存在的工具，或者在系统提示冲突时尝试使用别的工具。原生 FC 的 schema 和 tool call 字段通常由服务端协议承载，出错空间更小。

yaCA 的兜底包括：流式 parser、lenient error strategy、fallback、parse error 反馈、连续工具失败上限、工具 allow-list 和工具 hint。

### Q3：AgentLoop 为什么要抽象 assistant turn strategy？

因为 OpenAI tools 和 SXML 兼容模式的“单轮模型输出解析”完全不同，但后续流程是一样的：拿到 assistant 文本、工具调用、解析失败，然后执行工具、写入历史、进入下一轮。

把差异放进 strategy 后，AgentLoop 就能统一处理 max turns、max tool retry、权限确认、工具执行和历史追加。这比在一个大函数里到处写 `if compatible` 更可维护。

### Q4：会话为什么用 JSONL？

对会话消息来说，JSONL 很适合追加写入和逐条恢复，每行就是一条 ChatMessage。它比单个巨大 JSON 数组更适合 append，也方便定位损坏行。当前实现为了原子性仍然读旧内容后 atomic write，并加了 per-file queue 和 lock，后续可以进一步优化成真正 append + fsync。

### Q5：Web 端为什么不用直接渲染模型 HTML？

因为模型输出是不可信输入。直接插入主页面会有 XSS、样式污染、布局破坏等风险。yaCA-Web 使用 sandboxed iframe 隔离执行环境，并用 CSP、sanitizer、URL 限制、事件属性剥离来降低风险。

同时，iframe 不能每次流式更新都重建，否则会闪烁并影响性能。所以我做了稳定 shell + postMessage payload 更新。

### Q6：为什么高亮库要懒加载？

完整语法高亮 registry 比较重，而且流式阶段用户更关心内容快速出现，不一定需要马上高亮。yaCA-Web 在 streaming payload 阶段保持轻量，只在 final payload 阶段动态 import 高亮模块。这样可以降低首屏和流式更新成本。

### Q7：工具权限怎么保证安全？

首先默认 allow-list 只开放低风险只读工具，例如 `read_file`、`list_directory`、`stat_path`、`cwd`、`get_tool_hint`。写文件、执行命令等需要确认或配置 allow-list。其次 `exec_command` 有独立命令白名单，不是只允许工具名就完事。最后删除工具默认不允许删除 workspace 外部路径，除非显式传入危险参数。

### Q8：这个项目和 Claude Code / Codex CLI 的区别是什么？

它不是要全面替代成熟产品，而是面向学习和验证两个方向：

- 在低价模型和 OpenAI-compatible 服务上验证文本协议工具调用的可用性。
- 在 Web UI 上验证 HTML-first 输出是否能提高复杂回答的信息组织能力。

工程上我实现了 AgentLoop、工具系统、权限、会话、CLI、Web 和发布链路，能展示我对 Coding Agent 工作机制的理解，而不是只调用某个 SDK。

### Q9：如果继续优化，你会做什么？

优先级大概是：

1. 添加更多 HTML 预置类。现在的类名还比较基础，后续还可以考虑加入图表库、交互库等更丰富的组件支持，让模型能输出更丰富的 HTML 结构和交互。
2. 给 SXML 工具调用做更系统的 benchmark，量化不同模型的成功率、修复率和失败类型。
3. 完善工具 schema，支持更细的参数类型、required 字段和错误提示。
4. 优化 SessionStore 写入，从当前 atomic rewrite 进一步演进到更标准的 append + recovery。
5. 加强 Web HTML sanitizer，考虑接入成熟 HTML parser，减少正则 sanitizer 的边界风险。
6. 改进多工具并发、任务取消和长命令输出流式回传。

## 面试前建议复习的概念

- OpenAI tools/function calling 的消息格式：`tools`、`tool_calls`、`role: "tool"`、`tool_call_id`。
- SSE 流式响应：`data:` 行、`[DONE]`、chunk 合并。
- XML/HTML 流式解析和状态机基本思想。
- iframe sandbox、CSP、postMessage、ResizeObserver。
- XSS 基础：script、事件属性、`javascript:` URL、style 注入。
- Node.js `child_process.spawn`、shell 命令执行风险、timeout。
- JSONL、文件锁、atomic write、workspace hash。
- Monorepo、peerDependencies、exports、dynamic import、external bundling。
- React external store / Assistant UI 大概概念。
- Ink 为什么能用 React 写终端 UI。
