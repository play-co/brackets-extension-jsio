
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        React               = brackets.getModule("thirdparty/react");

    var io = require('deps/socket.io');
    require('deps/DevkitRemoteAPI');

    var LSKEY = 'bracketsExtensionJsio.';
    var TARGETS = [
        { UUID: 'local', name: 'Simulator', icon: 'desktop', postMessage: true },
        { UUID: 'remote', name: 'Add Remote Device', icon: 'plus', postMessage: true }
    ];

    var preferencesId = 'jsio';
    var _preferences;

    var reactDropdown;
    var listItems; // populated below

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
            _messageCallbackId++;

            data._requestId = requestId;
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

        // If this message is targeting a callback
        if (data._responseId !== undefined) {
            var callback = _messageCallbacks[data._responseId];
            if (!callback) {
                throw new Error('No callback registered for: ' + data._responseId);
            }
            _messageCallbacks[data._responseId] = undefined;

            callback(data);
            return;
        }
    });

    // ------------------ ------------------ ------------------

    /**
     * @param  {Object}  targetInfo
     * @param  {String}  targetInfo.UUID
     * @param  {String}  targetInfo.name
     * @return {Object}  newRunTarget
     */
    function addRunTarget(targetInfo) {
        if (!targetInfo.UUID) {
            console.error('error adding run target', targetInfo);
            throw new Error('run targets require a UUID');
        }
        if (getRunTargetById(targetInfo.UUID) !== null) {
            console.error('error adding run target', targetInfo);
            throw new Error('run targets require a UUID (one already exists)');
        }

        var newTarget = {
            UUID: targetInfo.UUID,
            name: targetInfo.name || targetInfo.UUID,
            status: targetInfo.status || 'unavailable'
        };

        listItems.splice(listItems.length - 1, 0, newTarget);
        reactDropdown && reactDropdown.forceUpdate();

        return newTarget;
    }

    /** only checks for matching id's */
    function removeRunTarget(targetUUID) {
        for (var i = listItems.length - 1; i >= 0; i--) {
            if (listItems[i].UUID === targetUUID) {
                listItems.splice(i, 1);
            }
        }

        validateCurrentSelection();
        reactDropdown && reactDropdown.forceUpdate();
    }

    /**
     * Will create a new run target with this UUID if one does not already exist
     * @param  {Object}  targetInfo
     * @param  {String}  targetInfo.UUID
     * @param  {String}  [targetInfo.name]
     * @param  {String}  [targetInfo.status]
     */
    function updateRunTarget(targetInfo) {
        if (!targetInfo.UUID) {
            console.error('error updating run target', targetInfo);
            throw new Error('run targets require a UUID');
        }

        var targetTarget = getRunTargetById(targetInfo.UUID);
        if (!targetTarget) {
            targetTarget = addRunTarget(targetInfo);
        }

        targetTarget.status = targetInfo.status;
        if (targetInfo.name) {
            targetTarget.name = targetInfo.name;
        }

        validateCurrentSelection();
        reactDropdown && reactDropdown.forceUpdate();
    }

    function getRunTargetById(targetId) {
        for (var i = listItems.length - 1; i >= 0; i--) {
            var testTarget = listItems[i];
            if (testTarget.UUID === targetId) {
                return testTarget;
            }
        }
        return null;
    }

    function setRunTarget(target) {
        window.localStorage[LSKEY + 'runTarget'] = target;
        postmessageRunTarget();
    }

    function validateCurrentSelection() {
        // Validate the currect selection (and select simulator if the current selection is no longer valid)
        /*var target = reactDropdown.state.selectedItem;
        if (target.status === 'unavailable' || listItems.indexOf(target) === -1) {
            reactDropdown.setState({
                selectedItem: listItems[0]
            });
        }*/
    }

    function postmessageRunTarget() {
        var target = window.localStorage[LSKEY + 'runTarget'];
        if (target) {
            _postMessage({
                target: 'simulator',
                action: 'setTarget',
                runTarget: target
            });
        }
    }

    /** Return the TARGET object currently set by localstorage */
    function getSelectedTarget() {
        var target = window.localStorage[LSKEY + 'runTarget'];
        if (!target) {
            return null;
        }
        for (var i = 0; i < TARGETS.length; i++) {
            var testTarget = TARGETS[i];
            if (testTarget.UUID === target) {
                return testTarget;
            }
        }
        return null;
    }

    function resetListItems() {
        // These will be the actual items displayed in the list
        listItems = TARGETS.slice(0);
        // Add a spacer after the local run target
        listItems.splice(1, 0, { spacer: true });

        // Need to make sure our dropdown is referencing the right array
        if (reactDropdown) {
            reactDropdown.setProps({
                items: listItems
            });
        }
    }

    function initJsioConnection() {
        // Prime the parent app with the saved run target
        postmessageRunTarget();
        resetListItems();

        var RemoteAPI = GC.RemoteAPI;
        // TODO: fix this
        var socketUrl = 'wss://devkit-joeorg.dev-js.io/companion/remotesocket/ui';
        RemoteAPI.init(socketUrl, {
            io: io
        });

        RemoteAPI.on('connectionStatus', function(data) {
            if (data.connected) {
                RemoteAPI.send('requestRunTargetList');
            }
        });

        RemoteAPI.on('runTargetList', function(data) {
            if (!Array.isArray(data.runTargets)) {
                console.error('error while consuming getRunTargetList response');
                return;
            }

            resetListItems();
            data.runTargets.forEach(addRunTarget);
        });

        RemoteAPI.on('removeRunTarget', function(data) {
            removeRunTarget(data.UUID);
        });
        RemoteAPI.on('updateRunTarget', function(data) {
            updateRunTarget(data.runTargetInfo);
        });
    }

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

                if (item.status) {
                    className += ' status-' + item.status;

                    if (!item.icon) {
                        item.icon = 'circle status-icon';
                    }
                }

                var itemChildren = [
                    React.DOM.div({
                        className: 'name'
                    }, item.name),
                    React.DOM.div({
                        className: 'selected-icon ' + selectedIcon
                    })
                ];

                if (item.icon) {
                    itemChildren.unshift(
                        React.DOM.div({
                            className: 'icon fa fa-' + item.icon
                        })
                    );
                } else {
                    // Want to keep things in the right position
                    itemChildren.unshift(
                        React.DOM.div({
                            className: 'icon icon-spacer'
                        })
                    );
                }

                return React.DOM.li({
                    onClick: this.handleClick,
                    className: className,
                    title: item.UUID
                }, itemChildren);
            },

            handleClick: function(e) {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();

                var item = this.props.item;
                this.props.doSelectItem(item);
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
                if (item.spacer) {
                    return React.DOM.li({
                        className: 'spacer'
                    })
                } else {
                    return targetListItem({
                        item: item,
                        selected: this.props.selectedItem === item,
                        doSelectItem: this.props.doSelectItem
                    });
                }
            }
        }));

        var selectedItem = React.createFactory(React.createClass({
            handleClick: function(e) {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                this.props.doToggleOpen();
            },
            render: function(item) {
                var selectedItem = this.props.selectedItem;

                var selectedItemName = '<none>';

                if (selectedItem) {
                    selectedItemName = selectedItem.name;
                }

                return React.DOM.div({
                    className: 'selected-container'
                }, [
                    React.DOM.div({
                        className: 'selected-stop',
                        onClick: this.props.doStop,
                        disabled: selectedItem && selectedItem.status !== 'occupied'
                    }, '■'),
                    React.DOM.div({
                        className: 'selected-run',
                        onClick: this.props.doRun,
                        disabled: selectedItem && selectedItem.status === 'unavailable'
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
                var selectedTarget = getSelectedTarget();
                return {
                    open: false,
                    selectedItem: selectedTarget || this.props.items[0]
                };
            },

            doSelectItem: function(item) {
                // Special case for remote (fire the run immediately)
                if (item.UUID === 'remote') {
                    _postMessage({
                        target: 'simulator',
                        action: 'run',
                        runTarget: 'remote'
                    });
                    this.setState({
                        open: false
                    });
                    return;
                }

                this.setState({
                    selectedItem: item,
                    open: false
                });
                setRunTarget(item.UUID);
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

            /**
             * @param  {MouseEvent} [evt]
             */
            doRun: function(evt) {
                if (evt && evt.target.hasAttribute('disabled')) {
                    return;
                }

                var runTarget = this.state.selectedItem;
                if (runTarget.postMessage) {
                    _postMessage({
                        target: 'simulator',
                        action: 'run',
                        runTarget: runTarget.UUID,
                        newWindow: evt && evt.metaKey
                    });
                } else {
                    GC.RemoteAPI.send('run', {
                        runTargetUUID: runTarget.UUID
                    });
                }
            },

            /**
             * @param  {MouseEvent} [evt]
             */
            doStop: function(evt) {
                if (evt && evt.target.hasAttribute('disabled')) {
                    return;
                }

                var runTarget = this.state.selectedItem;
                if (runTarget.postMessage) {
                    _postMessage({
                        target: 'simulator',
                        action: 'stop',
                        runTarget: runTarget.UUID
                    });
                } else {
                    GC.RemoteAPI.send('stop', {
                        runTargetUUID: runTarget.UUID
                    });
                }
            },

            render: function() {
                var children = [
                    selectedItem({
                        selectedItem: this.state.selectedItem,
                        doToggleOpen: this.doToggleOpen,
                        doRun: this.doRun,
                        doStop: this.doStop
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

        // Make the element that react will render in to
        var $e = $('<div>');
        $e.addClass('jsio jsio-run-target');
        reactDropdown = React.render(dropdown({
            items: listItems
        }), $e[0]);
        return $e;
    }

    // Sync up with the parent jsio app
    initJsioConnection();

    AppInit.htmlReady(function () {
        _preferences = PreferencesManager.getExtensionPrefs(preferencesId);

        var $runMenu = _makeRunMenu();
        $('#titlebar').append($runMenu);

        // Hide the right bar
        $('#main-toolbar')[0].style.display = 'none';
        $('.main-view .content')[0].style.right = '0';

        // Add the custom ui theme
        $("body").append('<link rel="stylesheet" href="' + ExtensionUtils.getModulePath(module) + 'uitheme.css">');
    });

    var moduleUri = module.uri.substring(0, module.uri.lastIndexOf('/'));
    ExtensionUtils.addLinkedStyleSheet(moduleUri + '/fontawesome/css/font-awesome.css');
    ExtensionUtils.loadStyleSheet(module, 'jsio.less');

});
