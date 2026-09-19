/*
*   工具方法
*/
import {
    RE_FENCE,
    RE_HEADING,
    RE_HR,
    RE_BLOCKQUOTE,
    RE_LIST_ITEM,
    RE_LIST_START,
    RE_INDENTED_CODE,
    RE_TASK
} from '../config/regex.js';

// 判断一行是否为列表项
export function isListItem(line) {
    return RE_LIST_ITEM.test(line.trimStart());
}

// 实体字符转化
const TAG_ESCAPE = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};
export function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return TAG_ESCAPE[c]; });
}