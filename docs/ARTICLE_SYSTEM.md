# 文章系统使用指南

本文档介绍如何使用文章系统进行文章的创建、编辑、分类管理和检索。

## 目录

- [核心功能](#核心功能)
- [创建和编辑文章](#创建和编辑文章)
- [分类系统](#分类系统)
- [搜索功能](#搜索功能)
- [外链加载](#外链加载)
- [访问控制](#访问控制)
- [URL格式](#url格式)

---

## 核心功能

文章系统提供以下核心功能：

- **文章管理**: 创建、编辑、删除文章
- **Markdown编辑**: 实时预览的Markdown编辑器
- **分类管理**: 为文章分配多个分类
- **高级搜索**: 支持正则表达式的全文搜索
- **外链加载**: 从外部URL加载文章内容
- **SEO友好URL**: 可读性强的文章URL格式

---

## 创建和编辑文章

### 创建新文章

1. 访问 `/article/edit` 页面
2. 填写文章信息：
   - **标题**: 必填，最多200个字符
   - **内容**: 必填，使用Markdown格式，最多100,000个字符
   - **分类**: 选择或创建分类（可选）
   - **外链URL**: 填写外部内容链接（可选）
   - **发布状态**: 勾选后文章对所有人可见
3. 点击保存完成创建

### 编辑现有文章

1. 访问 `/article/<id>/edit` 页面
2. 修改需要更新的内容
3. 点击保存

> **注意**: 只有文章作者才能编辑自己的文章。

### 删除文章

删除操作需要在代码层面通过 `articleService.deleteArticle()` 方法执行，需验证作者身份。

---

## 分类系统

### 分类功能

- 每篇文章可以分配**一个或多个**分类
- 分类可以在创建或编辑文章时选择
- 支持创建新的分类
- 所有可用分类会在文章列表和详情页显示

### 分类管理

分类通过 `CategoryService` 进行管理：

- `createCategory(name, description)` - 创建新分类
- `getAllCategories()` - 获取所有分类
- `updateCategory(id, data)` - 更新分类
- `deleteCategory(id)` - 删除分类

---

## 搜索功能

### 基本搜索

在文章广场 (`/plaza`) 页面，使用搜索栏输入关键词进行搜索。

### 正则表达式搜索

搜索功能支持**正则表达式**模式匹配：

| 示例模式 | 说明 |
|---------|------|
| `关键词` | 搜索包含"关键词"的文章 |
| `技术\|教程` | 搜索包含"技术"或"教程"的文章 |
| `^\[教程\]` | 搜索标题以"[教程]"开头的文章 |
| `\d{4}` | 搜索包含4位数字的文章 |

### 搜索结果

- 搜索匹配文章的**标题**和**内容**
- 匹配的文本会**高亮显示**
- 无效的正则表达式会返回错误提示

### 搜索性能

- 搜索操作在2秒内完成（10,000篇文章以内）
- 搜索结果不分页，按相关性排序

---

## 外链加载

### 功能说明

外链加载功能允许从外部URL加载文章内容，适用于：
- 内容托管在其他平台
- 解决特定地区的访问限制
- 动态内容更新

### 使用方法

1. 在创建/编辑文章时，填写**外链URL**字段
2. URL必须是有效的HTTP/HTTPS链接
3. 支持加载纯文本或Markdown格式内容

### 加载规则

- **超时时间**: 5秒
- **支持的格式**: 纯文本、Markdown
- **错误处理**: 加载失败时显示降级提示信息

### 错误处理

当外链加载失败时（网络错误、超时、404等），系统会：
1. 显示友好的错误提示
2. 不会导致页面崩溃
3. 提供重试选项

---

## 访问控制

### 文章可见性

| 文章状态 | 谁可以查看 |
|---------|----------|
| 已发布 | 所有用户（包括未登录用户） |
| 未发布 | 仅文章作者 |

### 编辑权限

- 只有文章**作者**可以编辑自己的文章
- 作者ID在创建后**不可修改**
- 尝试编辑他人文章会返回403错误

---

## URL格式

### 文章URL结构

文章URL格式为：`/a/<uid>/<name>`

- `<uid>` - 作者的用户ID
- `<name>` - 文章的URL安全名称（从标题自动生成）

### URL名称生成规则

从文章标题自动生成URL名称：

1. 转换为小写
2. 中文字符转换为拼音或移除
3. 特殊字符替换为连字符
4. 仅保留字母、数字、连字符和下划线
5. 长度限制为100个字符

### 示例

| 标题 | 生成的URL |
|-----|----------|
| "我的第一篇文章" | `/a/user123/wo-de-di-yi-pian-wen-zhang` |
| "Hello World!" | `/a/user123/hello-world` |
| "技术教程 2024" | `/a/user123/ji-shu-jiao-cheng-2024` |

---

## API服务

### ArticleService

```typescript
// 创建文章
createArticle(data: CreateArticleInput): Promise<Article>

// 更新文章
updateArticle(id: string, data: UpdateArticleInput): Promise<Article>

// 获取文章
getArticleById(id: string): Promise<Article | null>
getArticleByUrl(uid: string, name: string): Promise<Article | null>

// 文章列表
listArticles(options: ListArticlesOptions): Promise<PaginatedArticles>

// 删除文章
deleteArticle(id: string, authorUid: string): Promise<boolean>
```

### SearchService

```typescript
// 搜索文章
searchArticles(query: string, options: SearchOptions): Promise<SearchResult>

// 验证正则表达式
validateRegex(pattern: string): { valid: boolean; error?: string }

// 高亮匹配文本
highlightMatches(text: string, pattern: string): string
```

### CategoryService

```typescript
// 分类CRUD
createCategory(name: string, description?: string): Promise<Category>
getAllCategories(): Promise<Category[]>
getCategoryById(id: string): Promise<Category | null>
updateCategory(id: string, data: UpdateCategoryInput): Promise<Category>
deleteCategory(id: string): Promise<boolean>

// 文章分类关联
addCategoriesToArticle(articleId: string, categoryIds: string[]): Promise<void>
removeCategoriesFromArticle(articleId: string, categoryIds: string[]): Promise<void>
getArticleCategories(articleId: string): Promise<Category[]>
```

---

## 技术栈

- **框架**: Astro 5.x
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **Markdown解析**: marked
- **认证**: JWT
- **测试**: Vitest + fast-check (属性测试)

---

## 相关文件

- **页面**:
  - `/src/pages/plaza.astro` - 文章广场
  - `/src/pages/a/[uid]/[name].astro` - 文章详情
  - `/src/pages/article/edit.astro` - 创建文章
  - `/src/pages/article/[id]/edit.astro` - 编辑文章

- **组件**:
  - `/src/components/ArticleCard.astro` - 文章卡片
  - `/src/components/CategorySelector.astro` - 分类选择器
  - `/src/components/SearchBar.astro` - 搜索栏
  - `/src/components/MarkdownIDE.astro` - Markdown编辑器
  - `/src/components/ExternalContentLoader.astro` - 外链加载器

- **服务**:
  - `/src/services/articleService.ts` - 文章服务
  - `/src/services/categoryService.ts` - 分类服务
  - `/src/services/searchService.ts` - 搜索服务
  - `/src/services/externalLoaderService.ts` - 外链加载服务

- **类型定义**:
  - `/src/types/article.ts` - 文章相关类型
  - `/src/types/errors.ts` - 错误类型
