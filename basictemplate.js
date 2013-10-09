/**
 * BasicTemplate.js - Very small, easy-to-use and fast Javascript Template Engine
 *
 * Copyright 2013, Jeferson Daniel <jeferson.daniel412@gmail.com>
 *
 * Licensed under GNU General Public License 3.0 or later. 
 * Some rights reserved. See COPYING, AUTHORS.
 *
 * @license GPL-3.0+ <http://spdx.org/licenses/GPL-3.0+>
 */

BasicTemplate = (function () {
    'use strict';
    var TOKEN_TYPE_TEXT     = 1,
        TOKEN_TYPE_VALUE    = 2,
        TOKEN_TYPE_IF       = 3,
        TOKEN_TYPE_ELSE     = 4,
        TOKEN_TYPE_ENDIF    = 5,
        TOKEN_TYPE_FOR      = 6,
        TOKEN_TYPE_ENDFOR   = 7,
        TOKEN_KEY_TYPE  = 0,
        TOKEN_KEY_DEPTH = 1,
        TOKEN_KEY_ARGUMENT = 2,
        STATUS_FIND_TAG     = 0,
        STATUS_PROCESS_TAG  = 1,
        STATUS_GROUP_TOKENS = 3,
        STATUS_PROCESS_TOKENS = 4,
        OPENTAG_RE  = '{{',
        CLOSETAG_RE = '}}',
        SPACE_RE    = new RegExp(/^\s+/),
        IF_RE       = new RegExp(/if\s+([^=]+)/),
        VALUE_RE    = new RegExp(/^[^=\s]+$/),
        FOR_RE      = new RegExp(/for\s+([a-zA-Z0-9_$]+)\s+in\s+([a-zA-Z0-9_$]+)$/),
        tokenCache  = {};

    /**
    * JS Implementation of MurmurHash2
    *
    * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
    * @see http://github.com/garycourt/murmurhash-js
    * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
    * @see http://sites.google.com/site/murmurhash/
    *
    * @param {string} str ASCII only
    * @param {number} seed Positive integer only
    * @return {number} 32-bit positive integer hash
    */
    
    function murmurhash2_32_gc(str, seed) {
        var l = str.length,
            h = seed ^ l,
            i = 0,
            k;

        while (l >= 4) {
            k =
                ((str.charCodeAt(i) & 0xff)) |
                ((str.charCodeAt(++i) & 0xff) << 8) |
                ((str.charCodeAt(++i) & 0xff) << 16) |
                ((str.charCodeAt(++i) & 0xff) << 24);

            k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));
            k ^= k >>> 24;
            k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));

            h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;

            l -= 4;
            ++i;
        }

        switch (l) {
        case 3: h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
        case 2: h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
        case 1: h ^= (str.charCodeAt(i) & 0xff);
        h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
        }

        h ^= h >>> 13;
        h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
        h ^= h >>> 15;

        return h >>> 0;
    }

    function isArray(obj) {
        return (Object.prototype.toString.call(obj) === "[object Array]");
    }

    function isFunction(obj) {
        return (Object.prototype.toString.call(obj) === "[object Function]");
    }

    function trim(text) {
        return text.replace(/^\s+/, "").replace(/\s+$/, "");
    }

    function TextScanner(text) {
        this.tail = text;
        this.pos  = 0;
    }

    TextScanner.prototype.scanUntil = function (re) {
        var findPos  = this.tail.search(re), match;

        if (findPos >= 0) {
            this.pos  += findPos;
            match      = this.tail.substr(0, findPos);
            this.tail  = this.tail.substr(findPos);
        } else {
            match     = this.tail;
            this.pos += this.tail.length;
            this.tail = '';
        }

        return match;
    };

    TextScanner.prototype.scan = function (re) {
        var matches = this.tail.match(re),
            advance = null;

        if (matches !== null) {
            advance   = matches[0].length;
            this.pos += advance;
            this.tail = this.tail.substr(advance);
            return matches[0];
        }
        return '';
    };

    TextScanner.prototype.getPos = function () {
        return this.pos;
    };

    TextScanner.prototype.end = function () {
        return (this.tail === '');
    };

    function Context(data) {
        this.data   = data || {};
        this.cache  = {};
    }

    Context.prototype.lookup = function (name) {
        var value,
            names = null,
            i = 0,
            c = 0;

        if (name.indexOf('.') === -1) {
            value = this.data[name];
        } else if (name !== '.') {
            if (name in this.cache) {
                return this.cache[name];
            }
            value = this.data;
            names = name.split('.');
            for (i = 0, c = names.length; i < c; i += 1) {
                if (names[i] in value) {
                    value = value[names[i]];
                } else {
                    value = '';
                }
            }
            this.cache[name] = value;
        }
        
        if (value === undefined) {
            if (this.parent) {
                value = this.parent.lookup(name);
            } else {
                value = '';
            }
        }

        if (isFunction(value)) {
            value = value.call(this.data);
        }
        
        return value;
    };

    Context.prototype.set = function (name, variable) {
        this.data[name] = variable;
        this.cache = {};
    };

    function Tokenizer(text) {
        this.text = text;
    }

    Tokenizer.prototype.buildTokens = function () {
        var searchPos   = 0,
            currentPos  = 0,
            currentDeep = 0,
            tokens      = [],
            token       = null,
            text        = this.text,
            currentText = null,
            openRE      = '{{',
            closeRE     = '}}',
            value       = null,
            firstChar   = null,
            match       = null,
            hash        = null,
            lastIfToken = null,
            argument    = null,
            lastText    = null;

        hash = murmurhash2_32_gc(this.text);

        if (hash in tokenCache) {
            return tokenCache[hash].slice(0);
        }
        
        while (searchPos !== -1) {

            currentText = text.substr(currentPos);
            searchPos   = currentText.indexOf(openRE);

            if (searchPos !== -1) {
                lastText = currentText.substr(0, searchPos);

                if (lastText !== '') {
                    tokens.push([TOKEN_TYPE_TEXT, currentDeep, lastText]);
                }

                currentPos  += searchPos;
                currentText  = currentText.substr(searchPos);
                
                searchPos   = currentText.indexOf(closeRE);
                if (searchPos !== -1) {
                    value = currentText.substr(2, searchPos - 2);
                    currentPos += searchPos + 2;

                    firstChar = value.charAt(0);

                    switch (firstChar) {
                        case 'i':
                            if (value.charAt(1) === 'f' && value.charAt(2) === ' ') {
                                match = value.match(IF_RE);
                                if (match.length === 2) {
                                    token = [TOKEN_TYPE_IF, currentDeep++, trim(match[1])];
                                    tokens.push(token);
                                    lastIfToken = token;
                                } else {
                                    throw new Error('BasicTemplate.js: Invalid if token "' + text + '"');
                                }
                            } else {
                                tokens.push([TOKEN_TYPE_VALUE, currentDeep, trim(value)]);
                            }
                            break;
                        case 'f':
                            if (value.charAt(1) === 'o' && value.charAt(2) === 'r' && value.charAt(3) === ' ') {
                                match = value.match(FOR_RE);

                                if (match.length === 3) {
                                    tokens.push([TOKEN_TYPE_FOR, currentDeep++, match[1], match[2]]);
                                } else {
                                    throw new Error('BasicTemplate.js: Invalid for token "' + text + '"');
                                }
                            } else {
                                tokens.push([TOKEN_TYPE_VALUE, currentDeep, trim(value)]);
                            }
                            break;
                        case 'e':
                            if (value === 'else') {
                                if (!lastIfToken) {
                                    throw new Error('BasicTemplate.js: Orphan else tag');
                                }

                                if (lastIfToken[TOKEN_KEY_ARGUMENT][0] === '!') {
                                    argument = lastIfToken[TOKEN_KEY_ARGUMENT].substr(1);
                                } else {
                                    argument = '!'+lastIfToken[TOKEN_KEY_ARGUMENT];
                                }

                                tokens.push([TOKEN_TYPE_ELSE, --currentDeep, argument]);
                                currentDeep += 1;
                            } else if (value === 'endif') {
                                tokens.push([TOKEN_TYPE_ENDIF, --currentDeep]);
                            } else if (value === 'endfor') {
                                tokens.push([TOKEN_TYPE_ENDFOR, --currentDeep]);
                            } else {
                                tokens.push([TOKEN_TYPE_VALUE, currentDeep, trim(value)]);
                            }
                            break;
                        default:
                            tokens.push([TOKEN_TYPE_VALUE, currentDeep, trim(value)]);
                    }
                }  
            } else if (currentText !== '') {
                tokens.push([TOKEN_TYPE_TEXT, currentDeep, currentText]);
            }
        }
        
        if (currentDeep !== 0)
            throw new Error("BasicTemplate.js: Unclosing tags on template");

        tokenCache[hash] = tokens.slice(0);
        return tokens;
    };

    function TemplateCompiler(templateString, model, tokens) {
        this.templateString = templateString;
        this.model  = model;
        this.tokens = tokens;
    }

    TemplateCompiler.prototype.compile = function () {
        var context     = new Context(this.model);

        if (!this.tokens) {
            this.tokens = new Tokenizer(this.templateString).buildTokens();
        } else {
            this.tokens = this.tokens.slice(0);
        }

        return this.compileTokens(this.tokens, context);
    };

    TemplateCompiler.prototype.compileTokens = function (tokens, context) {
        var token           = null,
            buffer          = [],
            groupToken      = null,
            groupedTokens   = [],
            status          = STATUS_PROCESS_TOKENS,
            tokenType       = null,
            aux             = null,
            count           = tokens.length,
            current         = 0;

        while (tokens.length > 0) {
            token = tokens.shift();

            if (status === STATUS_GROUP_TOKENS) {

                if (token[TOKEN_KEY_DEPTH] === groupToken[TOKEN_KEY_DEPTH]) {
                    buffer.push(this.processGroupToken(groupedTokens, context, groupToken));
                    status = STATUS_PROCESS_TOKENS;
                    groupedTokens = [];
                    groupToken    = null;
                } else {
                    groupedTokens.push(token);
                    continue;
                }
            }

            tokenType = token[TOKEN_KEY_TYPE];
            if (tokenType === TOKEN_TYPE_IF ||
                    tokenType === TOKEN_TYPE_ELSE ||
                    tokenType === TOKEN_TYPE_FOR) {
                status      = STATUS_GROUP_TOKENS;
                groupToken  = token;
                continue;
            }

            switch (token[TOKEN_KEY_TYPE]) {

            case TOKEN_TYPE_TEXT:
                buffer.push(token[TOKEN_KEY_ARGUMENT]);
                break;
            case TOKEN_TYPE_VALUE:
                buffer.push(context.lookup(token[TOKEN_KEY_ARGUMENT]));
                break;

            }
        }

        return buffer.join('');
    };

    TemplateCompiler.prototype.processGroupToken = function (
        groupedTokens,
        context,
        groupToken
    ) {

        var text = '';

        switch (groupToken[TOKEN_KEY_TYPE]) {

        case TOKEN_TYPE_IF:
            text = this.processIfGroup(groupedTokens, context, groupToken);
            break;
        case TOKEN_TYPE_ELSE:
            text = this.processIfGroup(groupedTokens, context, groupToken);
            break;
        case TOKEN_TYPE_FOR:
            text = this.processForGroup(groupedTokens, context, groupToken);
            break;

        }

        return text;
    };

    TemplateCompiler.prototype.processIfGroup = function (
        groupedTokens,
        context,
        groupToken
    ) {

        var argument    = groupToken[TOKEN_KEY_ARGUMENT],
            search      = (argument[0] === '!') ? argument.substr(1) : argument,
            value       = context.lookup(search),
            result      = '';

        if ((value && argument[0] !== '!') || (!value && argument[0] === '!')) {
            result = this.compileTokens(groupedTokens, context);
        }

        return result;
    };

    TemplateCompiler.prototype.processForGroup = function (
        groupedTokens,
        context,
        groupToken
    ) {

        var newContext  = new Context({}, context),
            iterable    = context.lookup(groupToken[TOKEN_KEY_ARGUMENT + 1]),
            name        = groupToken[TOKEN_KEY_ARGUMENT],
            buffer      = [],
            tokens      = null,
            currentObject = null,
            i = 0,
            c = 0;

        if (isArray(iterable)) {
            for (i = 0, c = iterable.length; i < c; i += 1) {
                tokens = groupedTokens.slice(0);
                currentObject = iterable[i];

                newContext.set(name, currentObject);
                buffer.push(this.compileTokens(tokens, newContext));
            }
        }

        return buffer.join('');
    };

    return {
        'compile': function (strTemplate, model) {
            var templateCompiler = new TemplateCompiler(strTemplate, model);
            return templateCompiler.compile();
        },

        'compileWithTokens': function(tokens, model) {
            var templateCompiler = new TemplateCompiler(null, model, tokens);
            return templateCompiler.compile();
        },

        'tokenize': function(strTemplate) {
            return new Tokenizer(strTemplate).buildTokens();
        },

        'clearCache': function() {
            tokenCache = {};
        },

        'Context': Context
    };
}());