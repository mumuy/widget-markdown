# 基于Web component的Markdown组件

## 演示地址
[https://passer-by.com/widget-markdown/](https://passer-by.com/widget-markdown/)

## 组件安装
```shell
npm run widget-markdown
```

## 组件使用
```html
<widget-markdown src="https://www.passer-by.com/widget-markdown/README.md"></widget-markdown>
```

## 属性说明
<table>
    <caption><h3>组件属性</h3></caption>
    <thead>
        <tr><th>属性</th><th>说明</th></tr>
    </thead>
    <tbody>
        <tr><td>src</td><td>.md文件地址</td></tr>
    </tbody>
</table>

##  效果预览

**粗体**
*斜体*
***粗斜体***
~~删除线~~
<u>下划线</u> <!-- HTML -->

> 一级引用
>
> > 嵌套二级引用

> 引用内可以写 **粗体**

- [x] 完成任务
- [ ] 待办

这里有一句话[^note1]

[^note1]: 脚注内容，页面底部展示

***

- 无序列表 - 项目1
- 无序列表 - 项目2
  - 子项目（缩进2空格）
* 也可以用 *
+ 也可以用 +









1. 有序列表 - 条目1
2. 有序列表 - 条目2

| 姓名 | 年龄 | 城市 |
| ---- | ---- | ---- |
| 张三 | 22 | 上海 |
| 李四 | 25 | 北京 |

| 左对齐 | 居中对齐 | 右对齐 |
| :--- | :---: | ---: |
| a | b | c |

<p>原生HTML段落</p>
<span style="color:red;">红色文字</span>

术语1
: 术语解释

术语2
: 解释1
: 解释2

<details>
<summary>点击展开</summary>

隐藏内容，支持 **markdown**
</details>