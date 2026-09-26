---
title: 测试文章
cover: "[[cover.png]]"
---
# 大标题

这是一段**加粗**、*斜体*、==高亮==、`inline code` 和 [外链](https://example.com)，以及 [[另一篇笔记|别名]]。

![[pic one.png|300]]

![图注文字](assets/a.jpg)

## 代码

```ts
function hello(name: string) {
	// 注释
  return `hi ${name}`;   // 多个空格
}
```

> [!tip] 小提示
> 这里是 callout 内容 [[不应处理]] 

> 普通引用

***

## 第三节

### 小节标题

正文收尾。

- [ ] 待办
- [x] 完成
  - 嵌套

| a | b |
|---|---|
| 1 | 2 |

%%隐藏注释%%
行内代码不处理 `[[x]] ==y==`
