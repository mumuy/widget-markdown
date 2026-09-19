const RE_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;                 // 围栏代码块起始
const RE_HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+\s*)?$/;   // 标题
const RE_HR = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;                // 分隔线
const RE_BLOCKQUOTE = /^ {0,3}>/;                             // 引用
const RE_LIST_ITEM = /^([-+*]|\d+[.)])\s+(.*)$/;              // 列表项
const RE_LIST_START = /^ {0,3}([-+*]|\d+[.)])\s+/;            // 列表起始
const RE_INDENTED_CODE = /^ {4,}\S/;                          // 4 空格缩进代码块
const RE_TASK = /^\[([ xX])\]\s+(.*)$/;                       // 任务列表项
// 块级 HTML 标签（CommonMark type 6）
const RE_BLOCK_TAG = /^(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)$/i;
// void 元素：无闭合标签
const RE_VOID_TAG = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
const RE_FOOTNOTE_DEF = /^\s{0,3}\[\^([^\]]+)\]:\s*(.*)$/;    // 脚注定义 [^id]: 内容
const RE_FOOTNOTE_REF = /\[\^([^\]]+)\]/g;                    // 行内引用 [^id]

export {
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
}