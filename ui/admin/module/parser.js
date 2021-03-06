/**
 * 解析模块配置为html
 * {
 *  toolbar:[
 *        {
 *          type:"button",
 *          text:"新增",
 *          onclick:"alert(1)",
 *          iconCls:"icon-add"
 *        }
 *  ],
 *  condition:[
 *      {
 *
 *      }
 *  ]
 * }
 *
 */
define(["miniui-tools", "authorize", "request", "message"], function (tools, autz, request, message) {


    function Parser(config) {
        this.buttonType = {};
        this.conditionType = {};

        this.buttonTypeList = [
            {
                id: "button",
                name: "按钮",
                create: function (config) {
                    var html = $("<a class='mini-button' plain='true'>");
                    if (config.iconCls && config.iconCls.indexOf("fa") !== -1) {
                        html.append($("<i>").addClass(config.iconCls).text(" "+config.text));
                        delete config.text;
                        delete config.iconCls;
                    } else {
                        html.text(config.text);
                    }
                    html.attr(config);
                    html.attr("onclick", me.createOnclick(config.onclick));
                    console.log(html[0].outerHTML)
                    return html;
                }
            },
            {
                id: "menuButton",
                name: "菜单",
                create: function (config) {
                    function createMenu(parent, menus) {
                        $(menus).each(function () {
                            var li = $("<li>");
                            li.attr({iconCls: this.iconCls});
                            if (this.children && this.children.length > 0) {
                                li.append($("<span>")
                                    .attr({iconCls: this.iconCls})
                                    .text(this.text));
                                var ul = $("<ul>");
                                createMenu(ul, this.children);
                                li.append(ul);
                            } else {
                                li.text(this.text);
                            }
                            li.attr("onclick", me.createOnclick(this.onclick));
                            parent.append(li);
                        });
                    }

                    var id = "menu_" + (Math.round(Math.random() * 1000000));
                    var button = $("<a class=\"mini-menubutton\" plain=\"true\">");
                    var eventId = "e_" + (Math.round(Math.random() * 100000));
                    window[eventId] = function () {
                    };
                    button.attr({
                        iconCls: config.iconCls,
                        onclick: eventId,
                        menu: "#" + id,
                        id: config.id
                    });
                    button.html(config.text);
                    var menu = $("<ul class=\"mini-menu toolbar-menu\" style=\"display:none;\">")
                        .attr("id", id);
                    createMenu(menu, config.children);
                    $(document.body).append(menu);
                    return button;
                }
            }
        ];
        this.conditionTypeList = [
            {
                name: "文本输入",
                id: "textbox",
                create: function (config) {
                    var container = $("<div style='text-align: right;margin-top: 10px' class=\"mini-col-" + config.size + "\">");
                    var label = $("<label class='form-label'>").text(config.text)
                        .css({
                            "width": "200px",
                            "text-align": "right",
                            "font-size": "14px"
                        });
                    var input = $("<input style='width: 70%' class='mini-textbox'>")
                        .attr(config.editor)
                        .attr("name", config.id);
                    container.append(label).append(input);
                    return container;
                }
            },
            {
                name: "日期",
                id: "date",
                create: function (config) {
                    var container = $("<div style='text-align: right;margin-top: 10px' class=\"mini-col-" + config.size + "\">");
                    var label = $("<label class='form-label'>").text(config.text)
                        .css({
                            "width": "200px",
                            "text-align": "right",
                            "font-size": "14px"
                        });
                    var input = $("<input style='width: 70%' class='mini-datepicker'>")
                        .attr(config.editor)
                        .attr("name", config.id);
                    container.append(label).append(input);
                    return container;
                }
            }
        ];
        this.tools = tools;
        this.message = message;
        this.request = request;
        this.events = {};
        this.config = config;
        var me = this;
        $(me.buttonTypeList).each(function () {
            me.buttonType[this.id] = this;
        });
        $(me.conditionTypeList).each(function () {
            me.conditionType[this.id] = this;
        });

    }

    Parser.prototype.createOnclick = function (script) {
        var me = this;
        var eventId = "e_" + (Math.round(Math.random() * 100000));
        var call = typeof script === 'function' ? script : function () {
            if (script) {
                try {
                    var fun = eval("(function(){return function(){\n" +
                        script +
                        "\n}})()");
                    fun.call(me);
                } catch (e) {
                    console.log(script, e);
                }
            }
        };
        window[eventId] = call;
        return eventId;
    };

    Parser.prototype.parseToolbar = function (container, toolbar) {
        var me = this;
        $(toolbar).each(function () {
            var type = me.buttonType[this.type];
            if (type) {
                var html = type.create(this);
                container.append(html.css("margin-left","10px"));
            }
        });
    }

    Parser.prototype.parseCondition = function (container, condition) {
        var me = this;
        $(condition).each(function (i, e) {
            var type = me.conditionType[e.editor.type];
            if (type) {
                var html = type.create(e);
                html.addClass("search-condition");
                container.append(html);
            }
        });
    }

    Parser.prototype.parseDataGrid = function (container, config, onReady) {
        var me = this;
        var columns = mini.clone(config.columns);
        var actions = mini.clone(config.actions);
        var permission = config.permission;
        var newColumns = [];
        $(columns).each(function () {
            if (permission) {
                var hasAccess = autz.hasFieldAccess(permission, this.field, "query");
                if (!hasAccess) {
                    return;
                }
            }
            var renderer = this.renderer;
            if (this.condition) {
                try {
                    var fun = window.eval("(function(){return function(autz){\n" +
                        this.condition +
                        "\n}})()");
                    if (fun(autz) === false) {
                        return;
                    }
                } catch (e) {
                    console.log(renderer, e);
                }
            }
            if (renderer) {
                this.renderer = function (e) {
                    try {
                        var fun = window.eval("(function(){return function(){\n" +
                            renderer +
                            "\n}})()");
                        var p = {
                            "value": e.value,
                            "row": e.record,
                            "e": e,
                            "autz": autz,
                            "tools": tools,
                            "request": request,
                            "message": message
                        };
                        return fun.call(p);
                    } catch (e) {
                        console.log(renderer, e);
                    }
                    return e.value;
                };
            }
            if (!this.align) {
                this.align = "center";
            }
            if (!this.headerAlign) {
                this.headerAlign = "center";
            }
            newColumns.push(this);
        });

        if (actions && actions.length > 0) {
            newColumns.push({
                name: "action",
                "align": "center",
                "headerAlign": "center",
                "header": "操作"
            });
        }
        var gridId = "grid-" + (Math.round(Math.random() * 100000));

        var dataGridHtml = $("<div class='mini-datagrid'>");

        dataGridHtml.attr({
            id: gridId
        });
        dataGridHtml.css({
            "width": "100%",
            "height": "100%"
        });
        container.append(dataGridHtml);
        onReady(function () {
            var grid = mini.get(gridId);
            if (!grid) {
                console.log("初始化表格失败!");
                return;
            }
            tools.initGrid(grid);
            grid.setUrl(window.API_BASE_PATH + config.url);
            grid.set({
                columns: newColumns
            });
            var actionColumn = grid.getColumn("action");
            if (actionColumn) {
                actionColumn.renderer = function (e) {
                    var actionHtml = [];
                    $(actions).each(function () {
                        var action = this;
                        var condition = action.condition;
                        var show = true;
                        if (condition) {
                            try {
                                var fun = eval("(function(){return function(value,row,e,autz){\n" +
                                    condition +
                                    "\n}})()");
                                show = fun(e.value, e.record, e, autz);
                            } catch (e) {
                                console.log(renderer, e);
                            }
                        }
                        if (show) {
                            actionHtml.push(tools.createActionButton(action.text, action.icon, function () {
                                if (!action.onclick) {
                                    return;
                                }
                                try {
                                    var fun = eval("(function(){return function(){\n" +
                                        action.onclick +
                                        "\n}})()");
                                    show = fun.call({
                                        row: e.record, e: e, autz: autz, message: message, request: request, tools: tools,
                                        parser: me
                                    });
                                } catch (e) {
                                    console.log(action.onclick, e);
                                }
                            }))
                        }
                    });
                    return actionHtml.join("")
                }
            }
            return grid;
        });

    }

    Parser.prototype.buildQueryParam = function (conditionConfig, param, index, prefix) {
        var me = this;
        var terms = {};
        prefix = prefix || "";
        index = index || 0;
        $(conditionConfig).each(function () {
            var id = this.id;
            var val = param[id];
            var field = this.field;
            var termType = this.termType;

            if (typeof val === 'undefined' || val === '') {
                return;
            }
            if (termType === 'like' && val.indexOf("%") === -1) {
                val = '%' + val + '%';
            }

            terms[prefix + 'terms[' + index + '].column'] = field;
            terms[prefix + 'terms[' + index + '].value'] = val;
            terms[prefix + 'terms[' + index + '].termType'] = termType;
            index++;
        });
        return terms;
    }

    Parser.prototype.doEvent = function (event, args) {
        var events = this.events;
        $(events[event]).each(function () {
            this.call(args);
        });
    }
    Parser.prototype.on = function (event, func) {
        var events = this.events;
        if (!events[event]) {
            events[event] = [];
        }
        events[event].push(func);
    }

    Parser.prototype.parse = function (container, config, call) {
        var me = this;
        if (config.script) {
            try {
                eval("(function(){return function(){\n" +
                    config.script +
                    "\n}})()")
                    .call(me);
            } catch (e) {
                console.log(config.script, e);
            }
        }
        if (call) {
            call.call(me);
        }
        var toolbarHtml = $("<div class='mini-toolbar' style='border-bottom: 0px'>");
        var toolbar = $("<div style='margin-top: 10px'>");
        var formId = "form_" + Math.round(Math.random() * 100000);
        var condition = $("<div style='width: 90%;margin: auto' class='mini-clearfix'>")
            .attr("id", formId);

        toolbarHtml
            .append(condition).append(toolbar);

        var searchButton = $("<a class='mini-button'  >").text("查询");
        var resetButton = $("<a class='mini-button' plain='true' >").text("重置");
        var expandButton = $("<span style='cursor: pointer;font-size: 14px;color: #1890ff' >");
        expandButton.append(
            $("<span class='text'>").text("展开"))
            .append($("<i style='margin-left: 0.2em' class='fa fa-angle-down'>")).on('click', function () {
            var me = $(this);
            var len = condition.find(".search-condition").length;
            var size = len < 3 ? 4 : ((3 - (len % 3)) * 4);
            var text = me.find('.text');
            var icon = me.find(".fa");
            if (text.text() === '展开') {
                text.text("收起");
                icon.removeClass("fa-angle-down")
                    .addClass("fa fa-angle-up");
                condition.find(".search-condition:gt(1)").show();
                condition.find(".buttons").removeClass("mini-col-4");
                condition.find(".buttons").addClass("mini-col-" + size);
                mini.parse();
            } else {
                if (text.text() === '收起') {
                    text.text("展开");
                    icon.removeClass("fa-angle-up")
                        .addClass("fa fa-angle-down");
                    condition.find(".search-condition:gt(1)").hide();
                    condition.find(".buttons").removeClass("mini-col-" + size);
                    condition.find(".buttons").addClass("mini-col-4");
                    mini.parse();
                }
            }
        });

        var grid = $("<div class='mini-fit'>");
        container.html("")
            .append(toolbarHtml)
            .append(grid);
        me.parseToolbar(toolbar, config.toolbar);
        me.parseCondition(condition, config.condition);
        condition.find(".search-condition:gt(1)").hide();

        var conditionLen = condition.children().length;
        if (conditionLen < 3) {
            expandButton.hide();
        }
        if (conditionLen > 0) {
            condition.append($("<div class='buttons mini-col-4' style='margin-top: 10px;text-align: right'>")
                .append(searchButton)
                .append("<span style='margin-left: 0.5em'>")
                .append(resetButton)
                .append("<span style='margin-left: 0.5em'>")
                .append(expandButton));
        }
        var callQuery;

        // condition.find("input").attr("onenter",callQuery);

        me.parseDataGrid(grid, config.table, function (func) {
            searchButton.attr("onclick", me.createOnclick(function () {
                callQuery();
            }));
            resetButton.attr("onclick", me.createOnclick(function () {
                me.resetQuery();
            }));
            mini.parse();
            var gridObj = func();
            me.grid = gridObj;
            me.resetQuery = function () {
                var form = new mini.Form("#" + formId);
                form.reset();
                callQuery();
            };
            me.doQuery = callQuery = function () {
                var form = new mini.Form("#" + formId);
                var data = form.getData(true);
                var query = request.createQuery();
                var includes = ["id"];
                $(gridObj.getColumns()).each(function () {
                    if (this.field) {
                        includes.push(this.field);
                    }
                    if (this.displayField) {
                        includes.push(this.displayField);
                    }
                });
                me.doEvent("beforeQuery", {
                    query: query.nest(),
                    includes: includes
                });
                var prefix = "";
                if (query.terms.length > 0) {
                    prefix = "terms[" + (query.terms.length) + "].";
                }
                var formParams = me.buildQueryParam(config.condition, data, 0, prefix);

                var customParams = query.getParams();
                for (var e in customParams) {
                    formParams[e] = customParams[e];
                }
                formParams.includes = includes.join(",");
                gridObj.load(formParams);
            };

            callQuery();
            me.doEvent("load", {grid: grid, doQuery: callQuery})
        });
    };

    return Parser
});