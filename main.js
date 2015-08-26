
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        React               = brackets.getModule("thirdparty/react");

    var TARGETS = [
        { id: 'local', name: 'Simulator', icon: 'desktop' },
        { id: 'remote', name: 'Remote Device', icon: 'wifi' }
    ];

    var preferencesId = 'jsio';
    var _preferences;

    function _getCmd(cmdKey, cmdId,  cmdData) {
        var checkedPrefKey = cmdId + '.checked';
        // Register the command
        var cmd = CommandManager.register(cmdData.name, cmdId, function() {
            if (!cmd.getChecked()) {
                cmd.setChecked(true);
            } else {
                cmd.setChecked(false);
            }
        });
        // Checked?
        cmd.setChecked(_preferences.get(checkedPrefKey) || false);
        cmd.on('checkedStateChange', function() {
            _preferences.set(checkedPrefKey, Boolean(cmd.getChecked()));
        });
        return cmd;
    }

    /*
        Post message support between the embedded jsio editor and the main jsio app.
        Messages should be sent as stringified JSON.  Messages should have a `_jsio`
        property set to `true`.  Messages which expect a response should have a
        `_requestId`, and should expect a message with an equal `_responseId`.
     */
    var _messageCallbacks = {};
    var _messageCallbackId = 0;
    function _postMessage(data, callback) {
        console.log('jsio postmessage: ', data);
        data._jsio = true;

        if (window.parent === window) {
            console.error('parent is self, not sending message');
            return;
        }

        if (callback) {
            var requestId = 'brackets_' + _messageCallbackId;
            data._requestId = requestId;

            _messageCallbackId++;
            _messageCallbacks[requestId] = callback;
        }

        window.parent.postMessage(JSON.stringify(data), '*');
    }
    window.addEventListener('message', function(e) {
        try {
            var data = JSON.parse(e.data);
        } catch(err) {
            return;
        }
        if (!data._jsio) { return; }

        if (data._responseId !== undefined) {
            var callback = _messageCallbacks[data.responseId];
            if (!callback) {
                throw new Error('No callback registered for: ' + data._responseId);
            }
            _messageCallbacks[data.responseId] = undefined;

            callback(data);
            return;
        }
    });

    function _makeRunMenu() {
        var targetListItem = React.createFactory(React.createClass({
            render: function() {
                var item = this.props.item;
                var selectedIcon = '';
                var className = 'target-list-item';

                if (this.props.selected) {
                    className += ' selected';
                    selectedIcon = 'fa fa-check';
                }

                return React.DOM.li({
                    onClick: this.handleClick,
                    className: className
                }, [
                    React.DOM.div({
                        className: 'icon fa fa-' + item.icon
                    }),
                    React.DOM.div({
                        className: 'name'
                    }, item.name),
                    React.DOM.div({
                        className: 'selected-icon ' + selectedIcon
                    })
                ]);
            },

            handleClick: function(e) {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                this.props.doSelectItem(this.props.item);
            }
        }));

        var targetList = React.createFactory(React.createClass({
            render: function() {
                var items = this.props.items.map(this.renderItem);
                return React.DOM.ul({
                    className: 'target-list'
                }, items);
            },

            renderItem: function(item) {
                return targetListItem({
                    item: item,
                    selected: this.props.selectedItem === item,
                    doSelectItem: this.props.doSelectItem
                });
            }
        }));

        var selectedItem = React.createFactory(React.createClass({
            handleClick: function(e) {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                this.props.doToggleOpen();
            },
            render: function(item) {
                var selectedItemName = '<none>';
                if (this.props.selectedItem) {
                    selectedItemName = this.props.selectedItem.name;
                }

                return React.DOM.div({
                    className: 'selected-container'
                }, [
                    React.DOM.div({
                        className: 'selected-run',
                        onClick: this.props.doRun
                    }, '▶ Run'),
                    React.DOM.div({
                        className: 'selected-item',
                        onClick: this.handleClick
                    }, selectedItemName)
                ]);
            }
        }));

        var dropdown = React.createFactory(React.createClass({
            getInitialState: function () {
                return {
                    open: false,
                    selectedItem: this.props.items[0]
                };
            },

            doSelectItem: function(item) {
                this.setState({
                    selectedItem: item,
                    open: false
                });
                _postMessage({
                    target: 'simulator',
                    action: 'setTarget',
                    runTarget: item.id
                });
            },

            _documentClickListener: function(e) {
                this.doToggleOpen(false);
            },

            _documentKeyListener: function(e) {
                if (e.keyCode === 27) {
                    this.doToggleOpen(false);
                }
            },

            doToggleOpen: function(forceState) {
                var open = forceState !== undefined ? forceState : !this.state.open;

                this.setState({
                    open: open
                });

                // Click anywhere else to close
                if (open) {
                    document.addEventListener('click', this._documentClickListener);
                    document.addEventListener('keydown', this._documentKeyListener);
                } else {
                    document.removeEventListener('click', this._documentClickListener);
                    document.removeEventListener('keydown', this._documentKeyListener);
                }
            },

            doRun: function() {
                _postMessage({
                    target: 'simulator',
                    action: 'run',
                    runTarget: this.state.selectedItem.id
                });
            },

            render: function() {
                var children = [
                    selectedItem({
                        selectedItem: this.state.selectedItem,
                        doToggleOpen: this.doToggleOpen,
                        doRun: this.doRun
                    })
                ];
                if (this.state.open) {
                    children.push(
                        targetList({
                            items: this.props.items,
                            selectedItem: this.state.selectedItem,
                            doSelectItem: this.doSelectItem
                        })
                    );
                }

                return React.DOM.div({}, children);
            }
        }));

        var $e = $('<div>');
        $e.addClass('jsio jsio-run-target');
        React.render(dropdown({
            items: TARGETS,
            selectedItem: TARGETS[0]
        }), $e[0]);
        return $e;
    }

    AppInit.htmlReady(function () {
        _preferences = PreferencesManager.getExtensionPrefs(preferencesId);

        var $runMenu = _makeRunMenu();
        $('#titlebar').append($runMenu);

        // Hide live preview
        $('#toolbar-go-live').remove();
    });

    var moduleUri = module.uri.substring(0, module.uri.lastIndexOf('/'));
    ExtensionUtils.addLinkedStyleSheet(moduleUri + '/fontawesome/css/font-awesome.css');
    ExtensionUtils.loadStyleSheet(module, 'jsio.less');
});
