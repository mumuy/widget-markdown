/*
*   解析器
*/
import {
    RE_FENCE,
    RE_HEADING,
    RE_HR,
    RE_BLOCKQUOTE,
    RE_LIST_ITEM,
    RE_LIST_START,
    RE_INDENTED_CODE,
    RE_TASK,
    RE_BLOCK_TAG,
    RE_VOID_TAG,
    RE_FOOTNOTE_DEF,
    RE_FOOTNOTE_REF
} from './config/regex.js';
import {
    isListItem,
    escapeHtml
} from './method/utils.js';
import './package/widget-code.min.js';

export default class MarkdownParser{
    options;
    #footnotes
    #footnoteOrder
    constructor(options) {
        this.options = Object.assign({
            allowHtml: true
        },options);
    }
    parse(content){
        let lines = content.replace(/\r\n?/g, '\n').split('\n');
        this.#footnotes = {};
        this.#footnoteOrder = [];
        lines = this.#extractFootnotes(lines);
        return this.#parseBlocks(lines) + this.#renderFootnotes();
    }
    // 块级解析
    #parseBlocks(lines){
        let out = [];
        let i = 0;
        let line, result;
        while (i < lines.length) {
            line = lines[i];
            // 空行
            if (line.trim() === '') {
                // 多空行保留为空白：1 个空行是标准段落分隔，额外空行转为 <br> 留白
                let blank = 0;
                while (i < lines.length && lines[i].trim() === '') {
                    blank++;
                    i++;
                }
                if (blank >= 2 && out.length) {
                    out.push(Array(blank).join('<br>'));
                }
                continue;
            }
            // 围栏代码块
            if (RE_FENCE.test(line)) {
                result = this.#parseFence(lines, i);
                out.push(result.html);
                i = result.next;
                continue;
            }
            // 标题
            let heading = RE_HEADING.exec(line);
            if (heading) {
                let level = heading[1].length;
                out.push(`<h${level}>${this.#parseInline(heading[2])}</h${level}>`);
                i++;
                continue;
            }
            // 分隔线
            if (RE_HR.test(line)) {
                out.push('<hr>');
                i++;
                continue;
            }
            // 引用块
            if (RE_BLOCKQUOTE.test(line)) {
                result = this.#parseBlockquote(lines, i);
                out.push(result.html);
                i = result.next;
                continue;
            }
            // 列表
            if (RE_LIST_START.test(line)) {
                result = this.#parseList(lines, i);
                out.push(result.html);
                i = result.next;
                continue;
            }
            // 表格
            if (this.#isTableStart(lines, i)) {
                result = this.#parseTable(lines, i);
                out.push(result.html);
                i = result.next;
                continue;
            }
            // 缩进代码块
            if (RE_INDENTED_CODE.test(line)) {
                result = this.#parseIndentedCode(lines, i);
                out.push(result.html);
                i = result.next;
                continue;
            }
            // HTML 标签块（仅 allowHtml 时识别，原样输出；默认模式继续走段落转义）
            if (this.options.allowHtml && this.#isTagStart(lines, i)) {
                result = this.#parseTag(lines, i);
                out.push(result.html);
                i = result.next;
                continue;
            }
            // 普通段落
            result = this.#parseParagraph(lines, i);
            out.push(result.html);
            i = result.next;
        }
        return out.join('\n');
    }
    // 围栏代码块： ```lang ... ``` 或 ~~~lang ... ~~~
    #parseFence(lines, i) {
        let m = RE_FENCE.exec(lines[i]);
        let marker = m[1].charAt(0);
        let minLen = m[1].length;
        let lang = m[2].trim();

        let closeRe = marker === '`'
        ? new RegExp('^ {0,3}`{' + minLen + ',}\\s*$')
        : new RegExp('^ {0,3}~{' + minLen + ',}\\s*$');

        let code = [];
        let j = i + 1;
        while (j < lines.length && !closeRe.test(lines[j])) {
            code.push(lines[j]);
            j++;
        }
        let body = code.join('\n');
        let content = escapeHtml(body);

        const languageMap = {
            'js':'javascript'
        };
        return {
            html: `<widget-code language="${languageMap[lang]||lang}">${content}</widget-code>`,
            next: Math.min(j + 1, lines.length)
        };
    }
    // 引用块：支持嵌套、引用内空行、懒延续（> 段落后的普通行并入段落）
    #parseBlockquote = function (lines, i) {
        let list = [];
        let j = i;
        let prevWasQuote = false;
        while (j < lines.length) {
            let line = lines[j];
            if (RE_BLOCKQUOTE.test(line)) {
                list.push(line.replace(/^ {0,3}>\s?/, ''));
                prevWasQuote = true;
                j++;
            } else if (line.trim() === '') {
                let k = j;
                while (k < lines.length && lines[k].trim() === ''){
                    k++;
                }
                if (k < lines.length && RE_BLOCKQUOTE.test(lines[k])) {
                    list.push(''); // 引用内部的空行
                    prevWasQuote = false;
                    j = k;
                } else {
                    break;
                }
            } else if (prevWasQuote) {
                // 懒延续：并入引用
                list.push(line.trim());
                j++;
            } else {
                break;
            }
        }
        return {
            html: `<blockquote>\n${this.#parseBlocks(list)}\n</blockquote>`,
            next: j
        };
    }
    // 列表：按缩进递归解析任意层级，混合类型同一缩进会拆成相邻列表
    #parseList(lines, i) {
        let first = lines[i];
        let firstIndent = first.length - first.trimStart().length;
        let firstTrimmed = first.trimStart();
        let firstType = /^\d/.test(firstTrimmed) ? 'ol' : 'ul';
        let startNum = firstType === 'ol' ? parseInt(firstTrimmed.match(/^\d+/)[0], 10) : 1;
        let items = [];
        let current = null;
        let loose = false;
        let j = i;
        while (j < lines.length) {
            let line = lines[j];
            // 空行：向后探测，区分「项间空行」「项内续段」与「列表结束」；多空行保留为 <br> 留白
            if (line.trim() === '') {
                let k = j;
                while (k < lines.length && lines[k].trim() === ''){
                    k++;
                }
                if (k >= lines.length){
                    break;
                }
                var blank = k - j;      // 连续空行数
                let nextIndent = lines[k].length - lines[k].trimStart().length;
                let nextIsItem = isListItem(lines[k]);
                if (nextIsItem && nextIndent >= firstIndent) {
                    if (current) {
                        current.content.push('');
                        loose = true;   // 项间空行 -> 松散列表
                        if (blank >= 2) {
                            current.content.push({
                                br: blank - 1
                            });         // 多余空行 -> 前一项末尾留白
                        }
                    }
                    j = k;
                    continue;
                }
                // 项内续段需缩进达到「项内容缩进」（标记后至少 2 空格），否则列表在空行处结束
                if (!nextIsItem && nextIndent >= firstIndent + 2) {
                    if (current) {
                        current.content.push('');
                        loose = true;
                        if (blank >= 2) {
                            current.content.push({
                                br: blank - 1
                            }); // 多余空行 -> 续段前留白
                        }
                        current.content.push(lines[k].trimStart());
                    }
                    j = k + 1;
                    continue;
                }
                break;
            }
            let indent = line.length - line.trimStart().length;
            let item = RE_LIST_ITEM.exec(line.trimStart());
            // 同级列表项
            if (item && indent === firstIndent) {
                let type = /^\d/.test(item[1]) ? 'ol' : 'ul';
                if (type !== firstType) { // 同级但类型不同 -> 交给外层生成新列表
                    break;
                }
                current = {
                    content: []
                };
                let task = RE_TASK.exec(item[2]);
                current.task = task ? (task[1] !== ' ') : null;
                current.firstLine = task ? task[2] : item[2];
                items.push(current);
                j++;
                continue;
            }
            // 缩进更深：嵌套列表或项内续行
            if (indent > firstIndent) {
                if (isListItem(line)) {
                    if (!current) {
                        break;
                    }
                    let sub = this.#parseList(lines, j);
                    current.content.push({ sub: sub.html });
                    j = sub.next;
                    continue;
                }
                if (current) {
                    current.content.push(line.trimStart());
                }
                j++;
                continue;
            }
            break; // 缩进回退或非列表行 -> 列表结束
        }
        let tag = firstType === 'ol' ? 'ol' : 'ul';
        let startAttr = firstType === 'ol' && startNum !== 1 ? ' start="' + startNum + '"' : '';
        let list = [];
        for (let n = 0; n < items.length; n++) {
            list.push(this.#renderListItem(items[n], loose));
        }
        return {
            html: `<${tag + startAttr}>\n${list.join('\n')}\n</${tag}>`,
            next: j
        };
    }
    // 渲染单个列表项（content 中字符串为段落行，{sub} 对象为嵌套列表）
    #renderListItem(item, loose) {
        const _ = this;
        let list = [];
        let buf = [];

        function flush() {
            if (buf.length) {
                // 块内若构成表格，则整块走块级递归（支持列表项内的表格）
                let hasTable = false;
                for (let k = 0; k < buf.length - 1; k++) {
                    if (this.#isTableStart(buf, k)) { hasTable = true; break; }
                }
                if (hasTable) {
                    list.push(this.#parseBlocks(buf));
                    buf = [];
                    return;
                }
                let text = buf.join(' ');
                list.push(loose ? `<p>${_.#parseInline(text)}</p>` : _.#parseInline(text));
                buf = [];
            }
        }
        let all = [item.firstLine].concat(item.content);
        for (let i = 0; i < all.length; i++) {
            let entry = all[i];
            if (typeof entry === 'string') {
                if (entry === '') {
                    flush.call(this);
                    continue;
                }
                buf.push(entry);
            } else if (entry && entry.br) {
                flush.call(this);
                list.push(Array(entry.br + 1).join('<br>'));
            } else {
                flush.call(this);
                list.push(entry.sub);
            }
        }
        flush.call(this);
        // task 为 null 表示普通项，false 表示未勾选，两者都要保留
        return `<li${item.task != null ? ` class="task-list-item"`:``}>
            ${item.task != null? `<input type="checkbox" disabled${item.task?` checked`:``}>`: ``}
            <span>${list.join('\n')}</span>
        </li>`;
    }
    // 缩进代码块：连续 4+ 空格缩进的行（含结尾空行）
    #parseIndentedCode(lines, i) {
        let list = [];
        let j = i;
        while (j < lines.length) {
            let line = lines[j];
            if (RE_INDENTED_CODE.test(line)) {
                list.push(line.slice(4));
                j++;
            } else if (line.trim() === '') {
                list.push('');
                j++;
            } else {
                break;
            }
        }
        // 去掉末尾多余空行
        while (list.length && list[list.length - 1] === ''){
            list.pop();
        }
        return {
            html: `<pre><code>${escapeHtml(list.join('\n'))}</code></pre>`,
            next: j
        };
    }
    // 表格
    #isTableStart(lines, i) {
        let line = lines[i];
        if (!line || line.indexOf('|') === -1){
            return false;
        }
        let sep = lines[i + 1];
        if (!sep){
            return false;
        }
        if (!/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(sep)){
            return false;
        }
        if (sep.indexOf('-') === -1){
            return false;
        }
        return true;
    }
    #parseTable(lines, i) {
        let headerCells = this.#splitRow(lines[i]);
        let alignCells = this.#splitRow(lines[i + 1]);
        let aligns = alignCells.map(function (c) {
            let t = c.trim();
            if (/^:-+:$/.test(t)){
                return 'center';
            }
            if (/^:-+$/.test(t)){
                return 'left';
            }
            if (/^-+:$/.test(t)){
                return 'right';
            }
            return null;
        });

        let rows = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim() !== '' && lines[j].indexOf('|') !== -1) {
            rows.push(this.#splitRow(lines[j]));
            j++;
        }
        let th = [];
        for (let c = 0; c < headerCells.length; c++) {
            th.push(`<th${aligns[c]?` style="text-align:${aligns[c]}"`:``}>${this.#parseInline(headerCells[c].trim())}</th>`);
        }
        let trs = [];
        for (let r = 0; r < rows.length; r++) {
            let tds = [];
            for (let c = 0; c < headerCells.length; c++) {
                let cell = (rows[r][c] || '').trim();
                tds.push(`<td${aligns[c]?` style="text-align:${aligns[c]}"`:``}>${this.#parseInline(cell)}</td>`);
            }
            trs.push(`<tr>${tds.join('')}</tr>`);
        }
        return {
            html: `<table>
                <thead>
                    <tr>${th.join('')}</tr>
                </thead>
                <tbody>${trs.join('\n')}</tbody>
            </table>`,
            next: j
        };
    }
    // 按未转义管道符拆分表格行，支持 \| 转义
    #splitRow(line) {
        line = line.trim();
        if (line.charAt(0) === '|'){
            line = line.slice(1);
        }
        if (line.charAt(line.length - 1) === '|') {
            line = line.slice(0, -1);
        }
        let list = [];
        let current = '';
        for (let i = 0; i < line.length; i++) {
            let ch = line.charAt(i);
            if (ch === '|') {
                if (i > 0 && line.charAt(i - 1) === '\\') {
                    current = current.slice(0, -1) + '|';
                } else {
                    list.push(current);
                    current = '';
                }
            } else {
                current += ch;
            }
        }
        list.push(current);
        return list;
    }
    // HTML标签块
    #isTagStart(lines, i) {
        let line = lines[i];
        if (!line){
            return false;
        }
        let tag = /^\s*<([a-zA-Z][a-zA-Z0-9-]*)([\s>/])/.exec(line);
        if (!tag) {
            return false;
        }
        return RE_BLOCK_TAG.test(tag[1]);
    }
    #parseTag = function (lines, i) {
        let firstLine = lines[i];
        let match = /^\s*<([a-zA-Z][a-zA-Z0-9-]*)/.exec(firstLine);
        let tag = match[1].toLowerCase();

        let list = [];
        let j = i;
        while (j < lines.length && lines[j].trim() !== '') {
            let line = lines[j];
            list.push(line);
            // 单行块：自闭合（<div .../>）、void 元素（<hr>）、或已含闭合标签（<div>..</div>）
            if (j === i && (/\s\/\s*>$/.test(line) || RE_VOID_TAG.test(tag) || new RegExp('</' + tag + '\\s*>', 'i').test(line))) {
                j++;
                break;
            }
            // 多行块：出现闭合标签即止（含该行）
            if (j > i && new RegExp('</' + tag + '\\s*>', 'i').test(line)) {
                j++;
                break;
            }
            j++;
        }
        return {
            html: list.join('\n'),
            next: j
        };
    }
    // 脚注（GFM）
    #extractFootnotes(lines) {
        let i = 0;
        while (i < lines.length) {
            let m = RE_FOOTNOTE_DEF.exec(lines[i]);
            if (!m) {
                i++;
                continue;
            }
            let id = m[1];
            let def = this.#footnotes[id];
            if (!def) {
                def = this.#footnotes[id] = {
                    index: this.#footnoteOrder.length,
                    lines: []
                };
                this.#footnoteOrder.push(id);
            }
            if (m[2].trim() !== '') {
                def.lines.push(m[2]);
            }
            lines[i] = '';
            i++;
            // 收集续行：缩进 ≥ 4 的行；空行后若下一个非空行仍缩进则空行也属定义（分段）
            while (i < lines.length) {
                if (RE_FOOTNOTE_DEF.test(lines[i])){
                    break;           // 新定义
                }
                let line = lines[i];
                if (line.trim() === '') {
                    let k = i;
                    while (k < lines.length && lines[k].trim() === '') {
                        k++;
                    }
                    if (k < lines.length && /^\s{4,}\S/.test(lines[k])) {
                        def.lines.push('');
                        for (let q = i; q < k; q++){
                            lines[q] = '';        // 清掉中间的空行
                        }
                        i = k;                                          // 跳到缩进行继续
                        continue;
                    }
                    break;                                              // 空行结束定义
                }
                if (/^\s{4,}/.test(line)) {
                    def.lines.push(line.replace(/^\s+/, ''));           // 去缩进存入内容
                    lines[i] = '';
                    i++;
                } else {
                    break;                                              // 非缩进行结束定义
                }
            }
        }
        return lines;
    };
    // 渲染脚注区块：<section class="footnotes">…<ol><li id="fn-…">…</ol>
    #renderFootnotes() {
        if (!this.#footnoteOrder.length){
            return '';
        }
        let list = [];
        for (let i = 0; i < this.#footnoteOrder.length; i++) {
            let id = this.#footnoteOrder[i];
            let def = this.#footnotes[id];
            let content = def.lines.length ? this.#parseBlocks(def.lines) : '';
            list.push(
                `<li id="fn-${escapeHtml(id)}">
                    ${content}
                    <a href="#fnref-${escapeHtml(id)}" class="footnote-backref">↩</a>
                </li>`
            );
        }
        return `<section class="footnotes">
            <hr>
            <ol>${list.join('\n')}\n</ol>
        </section>`;
    }
    // 段落
    #startsBlock(lines, i) {
        let line = lines[i];
        if (/^ {0,3}(#{1,6})\s+/.test(line)){
            return true;
        }else if(RE_FENCE.test(line)){
            return true;
        }else if(RE_HR.test(line)){
            return true;
        }else if(RE_BLOCKQUOTE.test(line)){
            return true;
        }else if(RE_LIST_START.test(line)){
            return true;
        }else if(this.#isTableStart(lines, i)){
            return true;
        }else if(RE_INDENTED_CODE.test(line)){
            return true;
        }else if (this.options.allowHtml && this.#isTagStart(lines, i)){
            return true;
        }
        return false;
    }
    #parseParagraph = function (lines, i) {
        let list = [];
        let j = i;
        while (j < lines.length) {
            let line = lines[j];
            if (line.trim() === ''){
                break;
            }
            if (this.#startsBlock(lines, j)){
                break;
            }
            let t = line;
            // 行尾两个及以上空格 -> 硬换行 <br>（用占位符标记，避免被行内解析转义）
            if (/ {2,}$/.test(t) && t.replace(/ {2,}$/, '').trim() !== '') {
                t = t.replace(/ {2,}$/, '') + '\u0000BR\u0000';
            }
            list.push(t.trim());
            j++;
        }
        let text = list.join('\n').replace(/\n/g, ' ');
        return {
            html: `<p>${this.#parseInline(text)}</p>`,
            next: j
        };
    }
    #parseInline = function (text) {
        if (!text) {
            return '';
        }
        let t = text;
        let stashes = [];
        function stash(html) {
            let id = '\u0000S' + stashes.length + '\u0000';
            stashes.push(html);
            return id;
        }
        // 行内代码
        t = t.replace(/(`+)([\s\S]*?)\1/g, function (m, ticks, code) {
            return stash(`<code>${escapeHtml(code)}</code>`);
        });
        // 图片 ![alt](url "title")
        t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, function (m, alt, url, title) {
            return stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${title?` title="${escapeHtml(title)}"`:``}/>`);
        });
        // 链接 [文字](url "title")
        t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, function (m, label, url, title) {
            return stash(`<a href="${escapeHtml(url)}"${title?` title="${escapeHtml(title)}"`:``}>${this.#parseInline(label)}</a>`);
        }.bind(this));
        // 自动链接 <https://...> 与 <email@example.com>
        t = t.replace(/<((?:https?|ftp):\/\/[^\s<>]+)>/g, function (m, url) {
            return stash(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
        });
        t = t.replace(/<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/g, function (m, email) {
            return stash(`<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
        });
        // 脚注引用 [^id]
        t = t.replace(RE_FOOTNOTE_REF, function (m, id) {
            let def = this.#footnotes && this.#footnotes[id];
            if (!def){
                return m;
            }
            let n = def.index + 1;
            return stash(`<sub class="footnote-ref">
                <a href="#fn-${escapeHtml(id)}" id="fnref-${escapeHtml(id)}">${n}</a>
            </sub>`);
        }.bind(this));
        // 转义其余 HTML
        if (!this.options.allowHtml) {
            t = escapeHtml(t);
        }
        // 粗体 / 斜体 / 删除线
        t = t.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        t = t.replace(/(\*\*|__)([\s\S]+?)\1/g, '<strong>$2</strong>');
        t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
        t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
        t = t.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');
        // 还原占位符
        t = t.replace(/\u0000S(\d+)\u0000/g, function (m, idx) {
            return stashes[+idx];
        });
        // 还原硬换行占位符
        t = t.replace(/\u0000BR\u0000/g, '<br>');
        return t;
    };
}