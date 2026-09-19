import MarkdownParser from './module/parser.js';
import { escapeHtml } from './module/method/utils.js';
import styleSheet from './style/default.css' with { type: 'css'};

class WidgetMarkdown extends HTMLElement {
    #id
    #parser
    constructor() {
        super();
        this.attachShadow({mode:'open'});
    }
    static get observedAttributes(){
        return ['src'];
    }
    get src(){
        return this.getAttribute('src')||'';
    }
    set src(value){
        return this.setAttribute('src',value);
    }
    attributeChangedCallback(name, oldValue, newValue){
        if(oldValue!=newValue){
            this.context&&this.update();
        }
    }
    connectedCallback () {
        const _ = this;
        // 模板
        const defaultSheet = new CSSStyleSheet();
        const width = this.getAttribute('width')||300;
        const height = this.getAttribute('height')||300;
        if(_.shadowRoot.adoptedStyleSheets){
            _.shadowRoot.adoptedStyleSheets = [defaultSheet,styleSheet];
        }else{
            const $style = document.createElement('style');
            $style.rel = 'stylesheet';
            $style.textContent = [defaultSheet.cssRules,...styleSheet.cssRules].map(item=>item.cssText).join('');
            _.shadowRoot.appendChild($style);
        }
        
        // 节点
        _.shadowRoot.innerHTML = `<div class="mod-markdown">

        </div>`;
        _.$module = _.shadowRoot.querySelector('.mod-markdown');
        _.render();
    }
    // 统一渲染入口：有 src 则异步拉取文件，否则渲染标签内文本
    render(parser){
        const _ = this;
        _.#id = (_.#id || 0) + 1;       // 递增请求号，丢弃过期异步结果
        _.#parser = new MarkdownParser();
        if (_.src) {
            _.#loadFile();
        } else {
            _.#renderText(_.textContent || '');
        }
        return _;
    }
    #loadFile(){
        const _ = this;
        const id = _.#id;
        _.$module.setAttribute('data-status', 'loading');
        fetch(_.src, {
            'credentials': 'same-origin'
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ' ' + response.statusText);
            }
            return response.text();
        }).then(function (text) {
            if (id !== _.#id){
                return;
            }
            _.#renderText(text);
            _.dispatchEvent(new CustomEvent('load', {
                detail: {
                    src: _.src
                }
            }));
        }).catch(function (error) {
            if (id !== _.#id){
                return;
            }
            _.$module.setAttribute('data-status', 'error');
            _.$module.innerHTML = `<p class="text-red">加载失败：${escapeHtml(error.message || String(error))}</p>`;
            _.dispatchEvent(new CustomEvent('error',{
                detail: {
                    src: _.src,
                    message: error.message
                }
            }));
        });
    }
    #renderText(text) {
        const _ = this;
        _.$module.innerHTML = _.#parser.parse(text);
        _.$module.setAttribute('data-status', 'ready');
    }
}

if(!customElements.get('widget-markdown')){
    customElements.define('widget-markdown', WidgetMarkdown);
}
