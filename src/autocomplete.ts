/*
 * Autocomplete.js v2.0.0
 * Developed by Baptiste Donaux
 * http://autocomplete-js.com
 * 
 * Under MIT Licence
 * (c) 2015, Baptiste Donaux
 */
"use strict";

interface Params {
    // Custom params
    Delay:        number;
    EmptyMessage: string;
    HttpHeaders:  Object;
    HttpMethod:   string;
    Limit:        number;
    QueryArg:     string;
    Url:          string;

    // Keyboard mapping event
    KeyboardMappings: { [_: string]: MappingEvent; };

    // Workable elements
    DOMResults: HTMLElement;
    Request:    XMLHttpRequest;
    Input:      Element;
    Select:     Element;

    // Workflow methods
    _Blur:          any;
    _EmptyMessage:  any;
    _Focus:         any;
    _Limit:         any;
    _HttpMethod:    any;
    _Open:          any;
    _QueryArg:      any;
    _Position:      any;
    _Post:          any;
    _Render:        any;
    _Pre:           any;
    _Select:        any;
    _Url:           any;

    // Internal item
    $AjaxTimer:     number;
}

interface MappingCondition {
    Not: boolean;
}

interface MappingConditionIs extends MappingCondition {
    Is: number;
}

interface MappingConditionRange extends MappingCondition {
    From: number;
    To: number;
}

enum ConditionOperator { AND, OR };

interface MappingEvent {
    Conditions: MappingCondition[];
    Callback: any;
    Operator: ConditionOperator;
}

interface ResponseItem {
    Label: string;
    Value: string;
}
 
// Core
class AutoComplete {
    static merge: any = function(): any {
        var merge: any = {},
            tmp: any;

        for (var i = 0; i < arguments.length; i++) {
            for (tmp in arguments[i]) {
                merge[tmp] = arguments[i][tmp];
            }
        }

        return merge;
    };
    static defaults: Params = {
        Delay: 150,
        EmptyMessage: "No result here",
        HttpHeaders: {
            "Content-type": "application/x-www-form-urlencoded"
        },
        Limit: 0,
        HttpMethod: "GET",
        QueryArg: "q",
        Url: null,
        
        KeyboardMappings: {
            "Enter": {
                Conditions: [{
                    Is: 13,
                    Not: false
                }],
                Callback: function(event: KeyboardEvent) {
                    if (this.DOMResults.getAttribute("class").indexOf("open") != -1) {
                        var liActive = this.DOMResults.querySelector("li.active");
    
                        if (liActive !== null) {
                            this._Select(liActive);
                            this.DOMResults.setAttribute("class", "autocomplete");
                        }

                        // Cancel form send only if results element is open
                        event.preventDefault();
                    }
                },
                Operator: ConditionOperator.AND
            },
            "KeyUpAndDown": {
                Conditions: [{
                    Is: 38,
                    Not: false
                },
                {
                    Is: 40,
                    Not: false
                }],
                Callback: function(event: KeyboardEvent) {
                    var first = this.DOMResults.querySelector("li:first-child:not(.locked)"),
                        active = this.DOMResults.querySelector("li.active");
        
                    if (active) {
                        var currentIndex = Array.prototype.indexOf.call(active.parentNode.children, active),
                            position = currentIndex + (event.keyCode - 39),
                            lisCount = this.DOMResults.getElementsByTagName("li").length;
        
                        if (position < 0) {
                            position = lisCount - 1;
                        } else if (position >= lisCount) {
                            position = 0;
                        }
        
                        active.setAttribute("class", "");
                        active.parentElement.childNodes.item(position).setAttribute("class", "active");
                    } else if (first) {
                        first.setAttribute("class", "active");
                    }
                },
                Operator: ConditionOperator.OR
            },
            "AlphaNum": {
                Conditions: [{
                    Is: 13,
                    Not: true
                }, {
                    From: 35,
                    To: 40,
                    Not: true
                }],
                Callback: function(event: KeyboardEvent) {
                    var oldValue = this.Input.getAttribute("data-autocomplete-old-value"),
                        currentValue = this._Pre();
    
                    if (currentValue !== "") {
                        if (!oldValue || currentValue != oldValue) {
                            this.DOMResults.setAttribute("class", "autocomplete open");
                        }
    
                        AutoComplete.prototype.ajax(this, function() {
                            if (this.Request.readyState == 4 && this.Request.status == 200) {
                                this._Render(this._Post(this.Request.response));
                                this._Open();
                            }
                        }.bind(this));
                    }
                },
                Operator: ConditionOperator.AND
            }
        },

        DOMResults: document.createElement("div"),
        Request: null,
        Input: null,
        Select: null,
        
        _EmptyMessage: function(): string {
            console.log("EmptyMessage", this);

            if (this.Input.hasAttribute("data-autocomplete-empty-message")) {
                return this.Input.getAttribute("data-autocomplete-empty-message");
            }

            return this.EmptyMessage;
        },
        _Limit: function(): number {
            console.log("Limit", this);

            var limit = this.Input.getAttribute("data-autocomplete-limit");
            
            if (isNaN(limit)) {
                return this.Limit;
            }

            return parseInt(limit);
        },
        _HttpMethod: function(): string {
            console.log("_HttpMethod", this);

            if (this.Input.hasAttribute("data-autocomplete-method")) {
                return this.Input.getAttribute("data-autocomplete-method");
            }

            return this.HttpMethod;
        },
        _QueryArg: function(): string {
            console.log("QueryArg", this);

            if (this.Input.hasAttribute("data-autocomplete-param-name")) {
                return this.Input.getAttribute("data-autocomplete-param-name");
            }

            return this.QueryArg;
        },
        _Url: function(): string {
            console.log("Url", this);

            if (this.Input.hasAttribute("data-autocomplete")) {
                return this.Input.getAttribute("data-autocomplete");
            }

            return this.Url;
        },
        _Blur: function(now: boolean = false): void {
            console.log("Blur", "Close results div", this);
    
            if (now) {
                this.DOMResults.setAttribute("class", "autocomplete");
            } else {
                var params = this;
                setTimeout(function() {
                    params._Blur(true);
                }, 150);
            }
        },
        _Focus: function(): void {
            console.log("Focus", "Open results div", this);

            var oldValue: string = this.Input.getAttribute("data-autocomplete-old-value");

            console.log("Old value setted in input attribute", oldValue);
    
            if (!oldValue || this.Input.value != oldValue) {
                this.DOMResults.setAttribute("class", "autocomplete open");
            }
        },
        _Open: function(): void {
            console.log("Open", this);

            var params = this;
            Array.prototype.forEach.call(this.DOMResults.getElementsByTagName("li"), function(li) {
                li.onclick = function(event) {
                    params._Select(li);
                };
            });
        },
        _Position:function(): void {
            console.log("Build results position", this);

            this.DOMResults.setAttribute("class", "autocomplete");
            this.DOMResults.setAttribute("style", "top:" + (this.Input.offsetTop + this.Input.offsetHeight) + "px;left:" + this.Input.offsetLeft + "px;width:" + this.Input.clientWidth + "px;");
        },
        _Render: function(response: ResponseItem[]|string): void {
            console.log("_Render", this, "Response", response);

            var ul: HTMLElement = document.createElement("ul"),
                li: HTMLElement = document.createElement("li");
            
            if (typeof response == "string") {
                if (response.length > 0) {
                    this.DOMResults.innerHTML = response;
                } else {
                    li.setAttribute("class", "locked");
                    ul.appendChild(li);
                }
            } else {
                // Order
                if (this._Limit() < 0) {
                    response = response.reverse();
                }

                for (var item = 0; item < response.length; item++) {
                    li.innerHTML = response[item].Label;
                    li.setAttribute("data-autocomplete-value", response[item].Value);
                    
                    ul.appendChild(li);
                    li = document.createElement("li");
                }
            }
    
            if (this.DOMResults.hasChildNodes()) {
                this.DOMResults.childNodes[0].remove();
            }
            
            this.DOMResults.appendChild(ul);
        },
        _Post: function(response: string): ResponseItem[]|string {
            console.log("Post", this);

            try {
                var returnResponse: ResponseItem[] = [];
                
                //JSON return
                var json: string[]|Object = JSON.parse(response);

                
                if (Object.keys(json).length == 0) {
                    return "";
                }

                if (Array.isArray(json)) {
                    console.log("Response is a JSON Array");
    
                    for (var i = 0 ; i < Object.keys(json).length; i++) {
                        returnResponse[returnResponse.length] = { "Value": json[i], "Label": json[i] };
                    }
                } else {
                    console.log("Response is a JSON Object");

                    for (var value in json) {
                        returnResponse.push({
                            "Value": value,
                            "Label": json[value]
                        });
                    }
                }

                return returnResponse;
            } catch (event) {
                //HTML return
                console.log("Response is a HTML", "Exception", event);

                return response;
            }
        },
        _Pre: function(): string {
            console.log("Pre", this);
    
            return this.Input.value;
        },
        _Select: function(item: HTMLElement): void {
            console.log("Select", this);

            if (item.hasAttribute("data-autocomplete-value")) {
                this.Input.value = item.getAttribute("data-autocomplete-value");
            } else {
                this.Input.value = item.innerHTML;
            }
            this.Input.setAttribute("data-autocomplete-old-value", this.Input.value);

            if (this.Select !== void 0) {
                var option: HTMLElement = document.createElement("option");
                option.setAttribute("value", this.Input.value);
                option.setAttribute("selected", "selected");
                option.innerHTML = item.innerHTML;
    
                if (this.Select.hasChildNodes()) {
                    this.Select.childNodes[0].remove();
                }
                
                this.Select.appendChild(option);
            }
        },

        $AjaxTimer: null,
    };
    
    // Constructor
    constructor(params: Object = {}, selector: any = "[data-autocomplete]") {
        if (Array.isArray(selector)) {
            selector.forEach(function(s: string) {
                new AutoComplete(params, s);
            });
        } else if (typeof selector == "string") {
            var elements: NodeList = document.querySelectorAll(selector);
            Array.prototype.forEach.call(elements, function(input: HTMLElement) {
                new AutoComplete(params, input);
            });
        } else {
            console.log("AutoComplete declaration");

            // Custom params
            console.log("Custom params", params);
            // Default params
            console.log("Default params", AutoComplete.defaults);

            console.log("Selector", selector);

            AutoComplete.prototype.create(AutoComplete.merge(AutoComplete.defaults, params), selector);
        }
    }

    create(params: Params, element: HTMLElement): void {
        console.log("Object", params);

        if (element.nodeName.match(/^SELECT$/i)) {
            params.Select = element;

            params.Select.setAttribute("style", "display:none;");

            var input = document.createElement("input");
            input.setAttribute("type", "search");
            input.setAttribute("autocomplete", "off");

            params.Select.parentNode.appendChild(input);

            var attributes: NamedNodeMap = params.Select.attributes;
            for (var i = attributes.length - 1; i >= 0; i--) {
                if (attributes[i].name.match(/^data-autocomplete/i)) {
                    input.setAttribute(attributes[i].name, attributes[i].value);
                }
            }

            params.Input = input;
        } 

        if (params.Input.nodeName.match(/^INPUT$/i) && params.Input.getAttribute("type").match(/^TEXT|SEARCH$/i)) {
            params.Input.setAttribute("autocomplete", "off");
            params._Position(params);
            params.Input.parentNode.appendChild(params.DOMResults);

            params.Input.addEventListener("focus", params._Focus.bind(params));
            
            params.Input.addEventListener("keydown", AutoComplete.prototype.event.bind(null, params));

            params.Input.addEventListener("blur", params._Blur.bind(params));
            params.Input.addEventListener("position", params._Position.bind(params));
            params.Input.addEventListener("destroy", AutoComplete.prototype.destroy.bind(null, params));
        } else {
            console.log("Element not valid to build a autocomplete");
        }
    }

    event(params: Params, event: KeyboardEvent): void {
        console.log("Event", params, "KeyboardEvent", event);

        for (var name in params.KeyboardMappings) {
            var mapping: MappingEvent = AutoComplete.merge({
                    Operator: ConditionOperator.AND
                }, params.KeyboardMappings[name]),
                match: boolean = ConditionOperator.AND == mapping.Operator;

            mapping.Conditions.forEach(function(condition: {
                From: number,
                Is: number,
                Not: boolean,
                To: number
            }) {
                if ((match == true && mapping.Operator == ConditionOperator.AND) || (match == false && ConditionOperator.OR)) {
                    condition = AutoComplete.merge({
                        Not: false
                    }, condition);

                    // For MappingConditionIs object
                    if (condition.hasOwnProperty("Is")) {
                        if (condition.Is == event.keyCode) {
                            match = !condition.Not;
                        } else {
                            match = condition.Not;
                        }
                    }
                    // For MappingConditionRange object
                    else if (condition.hasOwnProperty("From") && condition.hasOwnProperty("To")) {
                        if (event.keyCode >= condition.From && event.keyCode <= condition.To) {
                            match = !condition.Not;
                        } else {
                            match = condition.Not;
                        }
                    }
                }
            });

            if (match == true) {
                mapping.Callback.bind(params, event)();
            }
        };
    }

    ajax(params: Params, callback: any, timeout: boolean = true): void {
        if (params.$AjaxTimer) {
            window.clearTimeout(params.$AjaxTimer);
        }

        if (timeout == true) {
            console.log("AJAX Timeout");
            
            params.$AjaxTimer = window.setTimeout(AutoComplete.prototype.ajax.bind(null, params, callback, false), params.Delay);
        } else {
            console.log("AJAX Sended", params);

            if (params.Request) {
                params.Request.abort();
            }
            
            var propertyHttpHeaders = Object.getOwnPropertyNames(params.HttpHeaders),
                method      = params._HttpMethod(),
                url         = params._Url(),
                queryParams = params.QueryArg + "=" + params._Pre();

            if (method.match(/^GET$/i)) {
                url += "?" + queryParams;
            }

            params.Request = new XMLHttpRequest();
            params.Request.open(method, url, true);

            for (var i = propertyHttpHeaders.length - 1; i >= 0; i--) {
                params.Request.setRequestHeader(propertyHttpHeaders[i], params.HttpHeaders[propertyHttpHeaders[i]]);
            }

            params.Request.onreadystatechange = callback;

            params.Request.send(queryParams);
        }
    }

    destroy(params: Params): void {
        console.log("Destroy event received", params);

        params.Input.removeEventListener("position", params._Position);
        params.Input.removeEventListener("focus", params._Focus);
        params.Input.removeEventListener("blur", params._Blur);
        // params.Input.removeEventListener("keyup", AutoComplete.prototype.event);
        params.DOMResults.parentNode.removeChild(params.DOMResults);

        // delete(params);
    }
}
